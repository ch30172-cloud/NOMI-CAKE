-- 0008: free delivery for orders whose items subtotal reaches a threshold.
-- The threshold is set by the owner in Settings (empty = no free delivery).

alter table public.business_settings
  add column if not exists free_delivery_min_agorot integer check (free_delivery_min_agorot is null or free_delivery_min_agorot >= 0);

-- create_order is unchanged except for the free-delivery block after the items loop.
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
  v_free_min integer;
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

  -- ---- free delivery above a threshold (items subtotal, before coupon) ----
  select free_delivery_min_agorot into v_free_min from public.business_settings where id = 1;
  if v_fulfillment = 'delivery' and v_free_min is not null and v_free_min > 0 and v_subtotal >= v_free_min then
    v_fee := 0;
  end if;

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
-- Matches the delivery note already shown on the site ("free on orders over 450").
update public.business_settings set free_delivery_min_agorot = 45000 where id = 1 and free_delivery_min_agorot is null;
