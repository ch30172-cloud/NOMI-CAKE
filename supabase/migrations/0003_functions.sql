-- =====================================================================
-- 0003: business logic functions, triggers and public RPCs.
--  * create_order(payload)  – atomic public order creation (prices, coupon,
--                             capacity and availability are all enforced here).
--  * validate_coupon(code, subtotal) – read-only coupon check for the cart.
--  * get_availability(from, to, kind) – per-day availability for customers.
--  * triggers: status history, coupon release, payment status, notifications.
-- =====================================================================

alter table public.payments add column if not exists is_deposit boolean not null default false;

-- ---------- current date in business timezone ----------
create or replace function public.business_today()
returns date language sql stable as $$
  select (now() at time zone coalesce((select timezone from public.business_settings where id = 1), 'Asia/Jerusalem'))::date;
$$;

-- ---------- capacity used for a date (see docs/CAPACITY_POLICY.md) ----------
create or replace function public.capacity_used(p_date date)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer
  from public.orders o
  cross join public.availability_rules r
  where o.scheduled_date = p_date
    and (
      o.status in ('confirmed', 'in_preparation', 'ready', 'completed')
      or (o.status = 'pending' and o.created_at > now() - make_interval(hours => r.pending_hold_hours))
    );
$$;

create or replace function public.capacity_limit(p_date date)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(
    (select max_orders from public.daily_order_limits where date = p_date),
    (select default_daily_limit from public.availability_rules where id = 1)
  );
$$;

-- ---------- public availability ----------
create or replace function public.get_availability(p_from date, p_to date, p_kind public.fulfillment_type)
returns table (
  date date,
  open_time time,
  close_time time,
  is_available boolean,
  reason text
)
language plpgsql stable security definer set search_path = public as $$
declare
  r public.availability_rules%rowtype;
  d date;
  min_date date;
  max_date date;
  bh public.business_hours%rowtype;
begin
  select * into r from public.availability_rules where id = 1;
  min_date := public.business_today() + r.min_lead_days;
  max_date := public.business_today() + r.max_days_ahead;
  if p_to - p_from > 120 then
    raise exception 'range too large';
  end if;
  d := p_from;
  while d <= p_to loop
    date := d;
    select * into bh from public.business_hours b
      where b.day_of_week = extract(dow from d) and b.kind = p_kind and b.is_active;
    open_time := bh.open_time;
    close_time := bh.close_time;
    if d < min_date then
      is_available := false; reason := 'too_soon';
    elsif d > max_date then
      is_available := false; reason := 'too_far';
    elsif bh.id is null then
      is_available := false; reason := 'closed';
    elsif exists (select 1 from public.blocked_dates b where b.date = d) then
      is_available := false; reason := 'blocked';
    elsif public.capacity_used(d) >= public.capacity_limit(d) then
      is_available := false; reason := 'full';
    else
      is_available := true; reason := null;
    end if;
    return next;
    d := d + 1;
  end loop;
end $$;
grant execute on function public.get_availability(date, date, public.fulfillment_type) to anon, authenticated;

-- ---------- coupon validation (read-only, limited info) ----------
create or replace function public.validate_coupon(p_code text, p_subtotal_agorot integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c public.coupons%rowtype;
begin
  select * into c from public.coupons where code = p_code and deleted_at is null;
  if c.id is null or not c.is_active then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  if c.starts_at is not null and c.starts_at > now() then
    return jsonb_build_object('valid', false, 'reason', 'not_started');
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;
  if c.max_redemptions is not null and c.redemption_count >= c.max_redemptions then
    return jsonb_build_object('valid', false, 'reason', 'exhausted');
  end if;
  if p_subtotal_agorot < c.min_order_agorot then
    return jsonb_build_object('valid', false, 'reason', 'min_order', 'min_order_agorot', c.min_order_agorot);
  end if;
  return jsonb_build_object(
    'valid', true,
    'code', c.code::text,
    'discount_type', c.discount_type,
    'value', c.value,
    'scope', c.scope,
    'product_id', c.product_id,
    'category_id', c.category_id,
    'min_order_agorot', c.min_order_agorot
  );
end $$;
grant execute on function public.validate_coupon(text, integer) to anon, authenticated;

-- ---------- create_order: the single public write path ----------
-- payload: {
--   idempotency_key, locale, customer: {name, phone, email, city},
--   fulfillment: 'pickup'|'delivery', delivery_city_id, delivery_address,
--   scheduled_date: 'YYYY-MM-DD', scheduled_time: 'HH:MM', notes, coupon_code,
--   items: [{product_id, variant_id, quantity, notes}]
-- }
create or replace function public.create_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key text := payload->>'idempotency_key';
  v_existing public.orders%rowtype;
  v_rules public.availability_rules%rowtype;
  v_date date := (payload->>'scheduled_date')::date;
  v_time time := (payload->>'scheduled_time')::time;
  v_fulfillment public.fulfillment_type := (payload->>'fulfillment')::public.fulfillment_type;
  v_bh public.business_hours%rowtype;
  v_city public.delivery_cities%rowtype;
  v_coupon public.coupons%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_qty integer;
  v_unit integer;
  v_line integer;
  v_subtotal integer := 0;
  v_eligible integer := 0;
  v_discount integer := 0;
  v_fee integer := 0;
  v_has_custom boolean := false;
  v_order_id uuid;
  v_items_count integer := 0;
  v_lines jsonb := '[]'::jsonb;
begin
  if v_key is null or length(v_key) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;

  -- Idempotency: same key => same order, no duplicate.
  select * into v_existing from public.orders where idempotency_key = v_key;
  if v_existing.id is not null then
    return jsonb_build_object('id', v_existing.id, 'order_number', v_existing.order_number,
                              'public_token', v_existing.public_token, 'duplicate', true);
  end if;

  select * into v_rules from public.availability_rules where id = 1;

  -- Serialize all order creation for this date (capacity check must be atomic).
  perform pg_advisory_xact_lock(hashtext('order-date:' || v_date::text));

  -- ---- date / time validation ----
  if v_date < public.business_today() + v_rules.min_lead_days then raise exception 'date_too_soon'; end if;
  if v_date > public.business_today() + v_rules.max_days_ahead then raise exception 'date_too_far'; end if;
  if exists (select 1 from public.blocked_dates where date = v_date) then raise exception 'date_blocked'; end if;
  select * into v_bh from public.business_hours
    where day_of_week = extract(dow from v_date) and kind = v_fulfillment and is_active;
  if v_bh.id is null then raise exception 'date_closed'; end if;
  if v_time < v_bh.open_time or v_time > v_bh.close_time then raise exception 'time_outside_hours'; end if;
  if (extract(epoch from v_time)::integer / 60) % v_rules.slot_minutes <> 0 then raise exception 'time_not_aligned'; end if;
  if exists (
    select 1 from public.blocked_time_slots s
    where s.date = v_date and (s.kind is null or s.kind = v_fulfillment)
      and v_time >= s.start_time and v_time < s.end_time
  ) then raise exception 'time_blocked'; end if;
  if public.capacity_used(v_date) >= public.capacity_limit(v_date) then raise exception 'date_full'; end if;

  -- ---- delivery ----
  if v_fulfillment = 'delivery' then
    select * into v_city from public.delivery_cities
      where id = (payload->>'delivery_city_id')::uuid and is_active and deleted_at is null;
    if v_city.id is null then raise exception 'city_unavailable'; end if;
    if coalesce(trim(payload->>'delivery_address'), '') = '' then raise exception 'address_required'; end if;
    v_fee := v_city.fee_agorot;
  end if;

  -- ---- coupon (locked row; redemption counted atomically) ----
  if coalesce(payload->>'coupon_code', '') <> '' then
    select * into v_coupon from public.coupons
      where code = payload->>'coupon_code' and deleted_at is null for update;
    if v_coupon.id is null or not v_coupon.is_active then raise exception 'coupon_invalid'; end if;
    if v_coupon.starts_at is not null and v_coupon.starts_at > now() then raise exception 'coupon_invalid'; end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at < now() then raise exception 'coupon_expired'; end if;
    if v_coupon.max_redemptions is not null and v_coupon.redemption_count >= v_coupon.max_redemptions then
      raise exception 'coupon_exhausted';
    end if;
  end if;

  -- ---- items & pricing (authoritative) ----
  for v_item in select * from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) loop
    v_items_count := v_items_count + 1;
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and deleted_at is null;
    if v_product.id is null then raise exception 'product_not_found'; end if;
    if not v_product.is_available then raise exception 'product_unavailable:%', v_product.id; end if;
    if v_qty < v_product.min_quantity then raise exception 'quantity_below_min:%', v_product.id; end if;
    if v_product.max_quantity is not null and v_qty > v_product.max_quantity then raise exception 'quantity_above_max:%', v_product.id; end if;

    v_variant := null; v_unit := null; v_line := null;
    case v_product.pricing_type
      when 'fixed' then
        v_unit := v_product.base_price_agorot;
      when 'by_size' then
        select * into v_variant from public.product_variants
          where id = (v_item->>'variant_id')::uuid and product_id = v_product.id and kind = 'size' and is_active;
        if v_variant.id is null then raise exception 'size_required:%', v_product.id; end if;
        v_unit := v_variant.price_agorot;
      when 'by_quantity' then
        select * into v_variant from public.product_variants
          where product_id = v_product.id and kind = 'quantity_tier' and is_active and min_quantity <= v_qty
          order by min_quantity desc limit 1;
        if v_variant.id is null then
          if v_product.base_price_agorot is null then raise exception 'no_tier:%', v_product.id; end if;
          v_unit := v_product.base_price_agorot;
        else
          v_unit := v_variant.price_agorot;
        end if;
      when 'custom' then
        v_has_custom := true;
    end case;

    if v_unit is not null then
      v_line := v_unit * v_qty;
      v_subtotal := v_subtotal + v_line;
      if v_coupon.id is not null then
        if v_coupon.scope = 'order'
           or (v_coupon.scope = 'product' and v_coupon.product_id = v_product.id)
           or (v_coupon.scope = 'category' and v_coupon.category_id = v_product.category_id) then
          v_eligible := v_eligible + v_line;
        end if;
      end if;
    end if;

    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id, 'variant_id', v_variant.id,
      'name_he', v_product.name_he, 'name_en', v_product.name_en,
      'variant_he', v_variant.label_he, 'variant_en', v_variant.label_en,
      'quantity', v_qty, 'unit', v_unit, 'line', v_line,
      'is_custom', v_product.pricing_type = 'custom',
      'notes', nullif(trim(coalesce(v_item->>'notes', '')), ''),
      'snapshot', jsonb_build_object('product', to_jsonb(v_product), 'variant', to_jsonb(v_variant))
    );
  end loop;
  if v_items_count = 0 then raise exception 'empty_order'; end if;

  -- ---- discount ----
  if v_coupon.id is not null then
    if v_subtotal < v_coupon.min_order_agorot then raise exception 'coupon_min_order'; end if;
    case v_coupon.discount_type
      when 'percent' then v_discount := floor(v_eligible * v_coupon.value / 100.0)::integer;
      when 'fixed' then v_discount := least(v_coupon.value, v_eligible);
      when 'free_delivery' then v_discount := v_fee;
    end case;
  end if;

  -- ---- insert ----
  insert into public.orders (
    idempotency_key, locale, customer_name, customer_phone, customer_email, city,
    fulfillment, delivery_city_id, delivery_city_name, delivery_address,
    scheduled_date, scheduled_time, notes,
    subtotal_agorot, discount_agorot, delivery_fee_agorot, total_agorot, has_custom_pricing,
    coupon_id, coupon_code
  ) values (
    v_key, coalesce(payload->>'locale', 'he'),
    trim(payload#>>'{customer,name}'), payload#>>'{customer,phone}', nullif(trim(coalesce(payload#>>'{customer,email}', '')), ''),
    nullif(trim(coalesce(payload#>>'{customer,city}', '')), ''),
    v_fulfillment, v_city.id, v_city.name_he, nullif(trim(coalesce(payload->>'delivery_address', '')), ''),
    v_date, v_time, nullif(trim(coalesce(payload->>'notes', '')), ''),
    v_subtotal, v_discount, v_fee, greatest(v_subtotal + v_fee - v_discount, 0), v_has_custom,
    v_coupon.id, v_coupon.code::text
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, variant_id, product_name_he, product_name_en, variant_label_he, variant_label_en,
    quantity, unit_price_agorot, line_total_agorot, is_custom_price, notes, snapshot
  )
  select v_order_id, (l->>'product_id')::uuid, (l->>'variant_id')::uuid, l->>'name_he', l->>'name_en',
         l->>'variant_he', l->>'variant_en', (l->>'quantity')::integer, (l->>'unit')::integer, (l->>'line')::integer,
         (l->>'is_custom')::boolean, l->>'notes', l->'snapshot'
  from jsonb_array_elements(v_lines) l;

  if v_coupon.id is not null then
    insert into public.coupon_redemptions (coupon_id, order_id) values (v_coupon.id, v_order_id);
    update public.coupons set redemption_count = redemption_count + 1 where id = v_coupon.id;
  end if;

  select * into v_existing from public.orders where id = v_order_id;
  return jsonb_build_object('id', v_existing.id, 'order_number', v_existing.order_number,
                            'public_token', v_existing.public_token, 'duplicate', false);
end $$;
-- Only the service role may call create_order (the app validates input before calling it).
revoke all on function public.create_order(jsonb) from public, anon, authenticated;

-- ---------- order triggers ----------
create or replace function public.orders_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, auth.uid());
  -- Outbox: admin notification + email (sent by the app worker with retries).
  insert into public.notifications (type, channel, order_id, payload)
  values
    ('order_created', 'admin', new.id, jsonb_build_object('order_number', new.order_number, 'customer_name', new.customer_name, 'total_agorot', new.total_agorot)),
    ('order_created', 'email', new.id, jsonb_build_object('order_number', new.order_number));
  return new;
end $$;
create trigger orders_after_insert after insert on public.orders
  for each row execute function public.orders_after_insert();

create or replace function public.orders_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
    if new.status = 'confirmed' and new.confirmed_at is null then new.confirmed_at := now(); end if;
    if new.status = 'cancelled' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
      -- Give the coupon use back (once).
      update public.coupon_redemptions set released_at = now()
        where order_id = new.id and released_at is null;
      if found and new.coupon_id is not null then
        update public.coupons set redemption_count = greatest(redemption_count - 1, 0) where id = new.coupon_id;
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger orders_status_change before update on public.orders
  for each row execute function public.orders_status_change();

-- ---------- payment status recompute ----------
create or replace function public.recompute_payment_status(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_paid integer; v_refunded integer; v_total integer; v_only_deposits boolean; v_status public.payment_status;
begin
  select coalesce(sum(amount_agorot) filter (where kind = 'payment'), 0),
         coalesce(sum(amount_agorot) filter (where kind = 'refund'), 0),
         coalesce(bool_and(is_deposit) filter (where kind = 'payment'), false)
    into v_paid, v_refunded, v_only_deposits
    from public.payments where order_id = p_order_id;
  select total_agorot into v_total from public.orders where id = p_order_id;
  if v_paid = 0 and v_refunded = 0 then v_status := 'unpaid';
  elsif v_paid - v_refunded <= 0 then v_status := 'refunded';
  elsif v_paid - v_refunded >= v_total and v_total > 0 then v_status := 'paid';
  elsif v_only_deposits then v_status := 'deposit_paid';
  else v_status := 'partially_paid';
  end if;
  update public.orders set payment_status = v_status where id = p_order_id and payment_status <> v_status;
end $$;

create or replace function public.payments_changed()
returns trigger language plpgsql as $$
begin
  perform public.recompute_payment_status(coalesce(new.order_id, old.order_id));
  return coalesce(new, old);
end $$;
create trigger payments_changed after insert or update or delete on public.payments
  for each row execute function public.payments_changed();

-- ---------- audit helper (callable by admins; service role writes directly) ----------
create or replace function public.log_audit(p_action text, p_entity text, p_entity_id text, p_before jsonb, p_after jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, before_data, after_data)
  select auth.uid(), p_action, p_entity, p_entity_id, p_before, p_after
  where public.is_admin();
$$;
grant execute on function public.log_audit(text, text, text, jsonb, jsonb) to authenticated;

-- ---------- dashboard aggregates (admin only) ----------
create or replace function public.dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  today date := public.business_today();
  result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'new_orders', (select count(*) from public.orders where status = 'pending'),
    'orders_today', (select count(*) from public.orders where scheduled_date = today and status <> 'cancelled'),
    'orders_week', (select count(*) from public.orders where scheduled_date between today and today + 6 and status <> 'cancelled'),
    'ordered_today_agorot', (select coalesce(sum(total_agorot), 0) from public.orders where created_at::date = today and status <> 'cancelled'),
    'ordered_month_agorot', (select coalesce(sum(total_agorot), 0) from public.orders where date_trunc('month', created_at) = date_trunc('month', now()) and status <> 'cancelled'),
    'received_month_agorot', (select coalesce(sum(case when kind = 'payment' then amount_agorot else -amount_agorot end), 0) from public.payments where date_trunc('month', paid_at) = date_trunc('month', today)),
    'pickup_count', (select count(*) from public.orders where fulfillment = 'pickup' and status <> 'cancelled' and created_at > now() - interval '90 days'),
    'delivery_count', (select count(*) from public.orders where fulfillment = 'delivery' and status <> 'cancelled' and created_at > now() - interval '90 days'),
    'coupon_discount_month_agorot', (select coalesce(sum(discount_agorot), 0) from public.orders where date_trunc('month', created_at) = date_trunc('month', now()) and status <> 'cancelled'),
    'top_products', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select i.product_name_he as name, sum(i.quantity) as qty
        from public.order_items i join public.orders o on o.id = i.order_id
        where o.status <> 'cancelled' and o.created_at > now() - interval '90 days'
        group by i.product_name_he order by qty desc limit 5
      ) t
    ),
    'monthly_sales', (
      select coalesce(jsonb_agg(m order by m.month), '[]'::jsonb) from (
        select to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
               sum(total_agorot) as ordered_agorot, count(*) as orders
        from public.orders where status <> 'cancelled' and created_at > now() - interval '12 months'
        group by 1
      ) m
    ),
    'monthly_received', (
      select coalesce(jsonb_agg(m order by m.month), '[]'::jsonb) from (
        select to_char(date_trunc('month', paid_at), 'YYYY-MM') as month,
               sum(case when kind = 'payment' then amount_agorot else -amount_agorot end) as received_agorot
        from public.payments where paid_at > today - interval '12 months'
        group by 1
      ) m
    ),
    'busy_days', (
      select coalesce(jsonb_agg(b), '[]'::jsonb) from (
        select d.date::date as date, public.capacity_used(d.date::date) as used, public.capacity_limit(d.date::date) as "limit"
        from generate_series(today, today + 14, interval '1 day') as d(date)
      ) b where b.used >= b."limit" * 0.8 and b."limit" > 0
    )
  ) into result;
  return result;
end $$;
grant execute on function public.dashboard_stats() to authenticated;
