-- =====================================================================
-- Nomi Nebentzhal – Cakes and Boutique Conditoria
-- 0001: core schema. All money amounts are stored as INTEGER agorot
-- (1 ILS = 100 agorot) to avoid floating point errors.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------- enums ----------
create type public.pricing_type as enum ('fixed', 'by_size', 'by_quantity', 'custom');
create type public.variant_kind as enum ('size', 'quantity_tier');
create type public.translation_status as enum ('none', 'suggested', 'approved');
create type public.order_status as enum ('pending', 'confirmed', 'in_preparation', 'ready', 'completed', 'cancelled');
create type public.payment_status as enum ('unpaid', 'deposit_paid', 'partially_paid', 'paid', 'refunded');
create type public.fulfillment_type as enum ('pickup', 'delivery');
create type public.payment_kind as enum ('payment', 'refund');
create type public.payment_method as enum ('cash', 'bit', 'bank_transfer', 'other');
create type public.discount_type as enum ('percent', 'fixed', 'free_delivery');
create type public.coupon_scope as enum ('order', 'product', 'category');
create type public.notification_status as enum ('pending', 'sent', 'failed');
create type public.notification_channel as enum ('email', 'admin');
create type public.admin_role as enum ('owner', 'staff');

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- admin users ----------
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  role public.admin_role not null default 'owner',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger admin_users_updated before update on public.admin_users for each row execute function public.set_updated_at();

-- is_admin(): used by RLS policies. SECURITY DEFINER so it can read admin_users regardless of RLS.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.is_active
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- ---------- categories ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_he text not null,
  name_en text,
  description_he text,
  description_en text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_active_idx on public.categories (is_active, sort_order) where deleted_at is null;
create trigger categories_updated before update on public.categories for each row execute function public.set_updated_at();

-- ---------- products ----------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  slug text not null unique,
  name_he text not null,
  name_en text,
  description_he text,
  description_en text,
  en_translation_status public.translation_status not null default 'none',
  pricing_type public.pricing_type not null default 'fixed',
  base_price_agorot integer check (base_price_agorot is null or base_price_agorot >= 0),
  min_quantity integer not null default 1 check (min_quantity >= 1),
  max_quantity integer check (max_quantity is null or max_quantity >= min_quantity),
  is_featured boolean not null default false,
  is_available boolean not null default true,
  allow_notes boolean not null default true,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_fixed_price_chk check (pricing_type <> 'fixed' or base_price_agorot is not null)
);
create index products_catalog_idx on public.products (category_id, sort_order) where deleted_at is null;
create index products_featured_idx on public.products (is_featured) where deleted_at is null and is_available;
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  storage_path text,
  alt_he text,
  alt_en text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

-- Variants:
--   by_size      -> kind = 'size', one row per size with its full price.
--   by_quantity  -> kind = 'quantity_tier', min_quantity is the tier threshold,
--                   price_agorot is the price PER UNIT from that quantity upward.
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind public.variant_kind not null,
  label_he text not null,
  label_en text,
  min_quantity integer check (min_quantity is null or min_quantity >= 1),
  price_agorot integer not null check (price_agorot >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id, sort_order);
create trigger product_variants_updated before update on public.product_variants for each row execute function public.set_updated_at();

-- Translation history / approvals. The live values are on products.name_en / description_en.
create table public.product_translations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  locale text not null check (locale in ('he', 'en')),
  name text not null,
  description text,
  source text not null default 'manual' check (source in ('manual', 'auto')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
create index product_translations_idx on public.product_translations (product_id, locale, created_at desc);

-- ---------- delivery ----------
create table public.delivery_cities (
  id uuid primary key default gen_random_uuid(),
  name_he text not null,
  name_en text,
  fee_agorot integer not null default 0 check (fee_agorot >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger delivery_cities_updated before update on public.delivery_cities for each row execute function public.set_updated_at();

-- ---------- availability ----------
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  kind public.fulfillment_type not null,
  open_time time not null,
  close_time time not null,
  is_active boolean not null default true,
  unique (day_of_week, kind),
  check (close_time > open_time)
);

create table public.availability_rules (
  id integer primary key default 1 check (id = 1),
  min_lead_days integer not null default 2 check (min_lead_days >= 0),
  max_days_ahead integer not null default 60 check (max_days_ahead >= 1),
  slot_minutes integer not null default 60 check (slot_minutes in (15, 30, 60, 120)),
  default_daily_limit integer not null default 10 check (default_daily_limit >= 0),
  pending_hold_hours integer not null default 48 check (pending_hold_hours >= 1),
  updated_at timestamptz not null default now()
);
create trigger availability_rules_updated before update on public.availability_rules for each row execute function public.set_updated_at();
insert into public.availability_rules (id) values (1);

create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  reason text,
  created_at timestamptz not null default now()
);

create table public.blocked_time_slots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time time not null,
  end_time time not null,
  kind public.fulfillment_type, -- null = applies to both pickup and delivery
  reason text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index blocked_time_slots_date_idx on public.blocked_time_slots (date);

create table public.daily_order_limits (
  date date primary key,
  max_orders integer not null check (max_orders >= 0),
  updated_at timestamptz not null default now()
);

-- ---------- coupons ----------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  discount_type public.discount_type not null,
  value integer not null default 0 check (value >= 0), -- percent (1-100) or agorot; ignored for free_delivery
  scope public.coupon_scope not null default 'order',
  product_id uuid references public.products(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  min_order_agorot integer not null default 0 check (min_order_agorot >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions >= 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  is_active boolean not null default true,
  terms_he text,
  terms_en text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_percent_chk check (discount_type <> 'percent' or value between 1 and 100),
  constraint coupons_scope_chk check (
    (scope = 'order') or (scope = 'product' and product_id is not null) or (scope = 'category' and category_id is not null)
  )
);
create trigger coupons_updated before update on public.coupons for each row execute function public.set_updated_at();

-- ---------- orders ----------
create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number integer not null unique default nextval('public.order_number_seq'),
  public_token uuid not null default gen_random_uuid(), -- lets the customer re-open their confirmation page
  idempotency_key text not null unique,
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  locale text not null default 'he' check (locale in ('he', 'en')),
  customer_name text not null,
  customer_phone text not null, -- E.164
  customer_email citext,
  fulfillment public.fulfillment_type not null,
  delivery_city_id uuid references public.delivery_cities(id) on delete set null,
  delivery_city_name text,
  delivery_address text,
  city text,
  scheduled_date date not null,
  scheduled_time time not null,
  notes text,
  subtotal_agorot integer not null default 0 check (subtotal_agorot >= 0),
  discount_agorot integer not null default 0 check (discount_agorot >= 0),
  delivery_fee_agorot integer not null default 0 check (delivery_fee_agorot >= 0),
  total_agorot integer not null default 0 check (total_agorot >= 0),
  has_custom_pricing boolean not null default false, -- true => total is partial, final price to be agreed
  coupon_id uuid references public.coupons(id) on delete set null,
  coupon_code text,
  whatsapp_message text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_delivery_chk check (fulfillment = 'pickup' or (delivery_city_id is not null and delivery_address is not null))
);
create index orders_schedule_idx on public.orders (scheduled_date, status);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_phone_idx on public.orders (customer_phone);
create index orders_created_idx on public.orders (created_at desc);
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name_he text not null,
  product_name_en text,
  variant_label_he text,
  variant_label_en text,
  quantity integer not null check (quantity >= 1),
  unit_price_agorot integer check (unit_price_agorot is null or unit_price_agorot >= 0),
  line_total_agorot integer check (line_total_agorot is null or line_total_agorot >= 0),
  is_custom_price boolean not null default false,
  notes text,
  snapshot jsonb not null default '{}'::jsonb, -- full product/variant snapshot at order time
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index order_status_history_idx on public.order_status_history (order_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind public.payment_kind not null default 'payment',
  amount_agorot integer not null check (amount_agorot > 0),
  method public.payment_method not null,
  paid_at date not null default current_date,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id, created_at);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  released_at timestamptz, -- set when the order is cancelled and the use is given back
  created_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id);

-- ---------- site content & settings ----------
create table public.business_settings (
  id integer primary key default 1 check (id = 1),
  business_name text not null default 'Nomi Nebentzhal',
  tagline text not null default 'CAKES AND BOUTIQUE CONDITORIA',
  logo_url text, -- null => the app falls back to /branding/logo-original.jpg
  whatsapp_phone text, -- E.164, e.g. +9725xxxxxxx. Set by the owner in the admin.
  business_email citext,
  pickup_address_he text,
  pickup_address_en text,
  opening_hours_he text,
  opening_hours_en text,
  delivery_info_he text,
  delivery_info_en text,
  announcement_he text,
  announcement_en text,
  announcement_active boolean not null default false,
  social_links jsonb not null default '{}'::jsonb, -- { instagram, facebook, tiktok }
  currency text not null default 'ILS',
  timezone text not null default 'Asia/Jerusalem',
  updated_at timestamptz not null default now()
);
create trigger business_settings_updated before update on public.business_settings for each row execute function public.set_updated_at();
insert into public.business_settings (id) values (1);

create table public.homepage_content (
  id integer primary key default 1 check (id = 1),
  hero_image_url text,
  hero_title_he text,
  hero_title_en text,
  hero_subtitle_he text,
  hero_subtitle_en text,
  about_title_he text,
  about_title_en text,
  about_he text,
  about_en text,
  about_image_url text,
  updated_at timestamptz not null default now()
);
create trigger homepage_content_updated before update on public.homepage_content for each row execute function public.set_updated_at();
insert into public.homepage_content (id) values (1);

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  storage_path text,
  alt_he text,
  alt_en text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- notifications (outbox) ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- e.g. 'order_created'
  channel public.notification_channel not null,
  order_id uuid references public.orders(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status public.notification_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  is_read boolean not null default false, -- for channel = 'admin'
  created_at timestamptz not null default now()
);
create index notifications_pending_idx on public.notifications (status, next_attempt_at) where status = 'pending';
create index notifications_admin_idx on public.notifications (channel, is_read, created_at desc);

-- ---------- audit ----------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id, created_at desc);

-- ---------- storage buckets ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true), ('site-media', 'site-media', true)
on conflict (id) do nothing;
