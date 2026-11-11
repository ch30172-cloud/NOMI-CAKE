-- 0006: fix dashboard_stats busy_days (generate_series returns timestamptz, capacity_used expects date).

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
