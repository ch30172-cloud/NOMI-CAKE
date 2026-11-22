-- 0007: internal helpers must not be callable through the public API.
-- capacity_used / capacity_limit reveal how many orders exist per day;
-- recompute_payment_status is only called from triggers and admin code.
-- create_order (service role) and triggers keep working: they run as the owner.

-- The payments trigger must keep calling recompute_payment_status after the revoke,
-- so it now runs as the owner (like the other triggers).
create or replace function public.payments_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_payment_status(coalesce(new.order_id, old.order_id));
  return coalesce(new, old);
end $$;

revoke execute on function public.capacity_used(date) from public, anon, authenticated;
revoke execute on function public.capacity_limit(date) from public, anon, authenticated;
revoke execute on function public.recompute_payment_status(uuid) from public, anon, authenticated;

-- Speeds up the per-phone anti-spam check in createOrderAction.
create index if not exists orders_phone_created_idx on public.orders (customer_phone, created_at desc);
