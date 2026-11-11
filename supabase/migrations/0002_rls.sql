-- =====================================================================
-- 0002: Row Level Security.
-- Rule of thumb:
--   * anon / customers may READ only public catalog & content rows.
--   * nobody but the admin can read orders, customers, payments, logs.
--   * all writes to business data go through admin policies (is_admin()).
--   * public order creation goes through SECURITY DEFINER RPCs (0003).
-- =====================================================================

alter table public.admin_users enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_translations enable row level security;
alter table public.delivery_cities enable row level security;
alter table public.business_hours enable row level security;
alter table public.availability_rules enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.blocked_time_slots enable row level security;
alter table public.daily_order_limits enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.business_settings enable row level security;
alter table public.homepage_content enable row level security;
alter table public.gallery_images enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- ---------- admin_users: a signed-in admin can read own row; only owners manage rows ----------
create policy "admin_users: self read" on public.admin_users
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- is_owner() is SECURITY DEFINER (see 0005) so the policy never queries admin_users recursively.
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.is_active and a.role = 'owner'
  );
$$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated, anon;
create policy "admin_users: owner manage" on public.admin_users
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- ---------- public catalog (read for everyone, write for admin) ----------
create policy "categories: public read" on public.categories
  for select using (deleted_at is null and (is_active or public.is_admin()));
create policy "categories: admin write" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "products: public read" on public.products
  for select using (deleted_at is null or public.is_admin());
create policy "products: admin write" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "product_images: public read" on public.product_images for select using (true);
create policy "product_images: admin write" on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "product_variants: public read" on public.product_variants
  for select using (is_active or public.is_admin());
create policy "product_variants: admin write" on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "product_translations: admin only" on public.product_translations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "delivery_cities: public read" on public.delivery_cities
  for select using (deleted_at is null and (is_active or public.is_admin()));
create policy "delivery_cities: admin write" on public.delivery_cities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "business_hours: public read" on public.business_hours for select using (true);
create policy "business_hours: admin write" on public.business_hours
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "availability_rules: public read" on public.availability_rules for select using (true);
create policy "availability_rules: admin write" on public.availability_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "blocked_dates: public read" on public.blocked_dates for select using (true);
create policy "blocked_dates: admin write" on public.blocked_dates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "blocked_time_slots: public read" on public.blocked_time_slots for select using (true);
create policy "blocked_time_slots: admin write" on public.blocked_time_slots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Daily limits are NOT public (they would reveal order volume). Availability is exposed via get_availability().
create policy "daily_order_limits: admin only" on public.daily_order_limits
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Coupons: never listed publicly. Validation happens via RPC validate_coupon().
create policy "coupons: admin only" on public.coupons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- orders & money: admin only ----------
create policy "orders: admin only" on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "order_items: admin only" on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "order_status_history: admin only" on public.order_status_history
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "payments: admin only" on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "coupon_redemptions: admin only" on public.coupon_redemptions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- content ----------
create policy "business_settings: public read" on public.business_settings for select using (true);
create policy "business_settings: admin write" on public.business_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "homepage_content: public read" on public.homepage_content for select using (true);
create policy "homepage_content: admin write" on public.homepage_content
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "gallery_images: public read" on public.gallery_images
  for select using (is_active or public.is_admin());
create policy "gallery_images: admin write" on public.gallery_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "notifications: admin only" on public.notifications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Audit logs: admins can read; inserts happen through the service role / RPC only.
create policy "audit_logs: admin read" on public.audit_logs
  for select to authenticated using (public.is_admin());

-- ---------- storage ----------
create policy "public read product images" on storage.objects
  for select using (bucket_id in ('product-images', 'site-media'));
create policy "admin upload media" on storage.objects
  for insert to authenticated with check (bucket_id in ('product-images', 'site-media') and public.is_admin());
create policy "admin update media" on storage.objects
  for update to authenticated using (bucket_id in ('product-images', 'site-media') and public.is_admin());
create policy "admin delete media" on storage.objects
  for delete to authenticated using (bucket_id in ('product-images', 'site-media') and public.is_admin());
