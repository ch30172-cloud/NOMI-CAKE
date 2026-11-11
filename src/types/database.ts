/**
 * Hand-maintained Supabase types matching supabase/migrations/*.sql.
 * Regenerate with `npx supabase gen types typescript --linked > src/types/database.ts`
 * once a Supabase project is linked (see README).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PricingType = "fixed" | "by_size" | "by_quantity" | "custom";
export type VariantKind = "size" | "quantity_tier";
export type TranslationStatus = "none" | "suggested" | "approved";
export type OrderStatus = "pending" | "confirmed" | "in_preparation" | "ready" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "deposit_paid" | "partially_paid" | "paid" | "refunded";
export type FulfillmentType = "pickup" | "delivery";
export type PaymentKind = "payment" | "refund";
export type PaymentMethod = "cash" | "bit" | "bank_transfer" | "other";
export type DiscountType = "percent" | "fixed" | "free_delivery";
export type CouponScope = "order" | "product" | "category";
export type NotificationStatus = "pending" | "sent" | "failed";
export type NotificationChannel = "email" | "admin";
export type AdminRole = "owner" | "staff";

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Required extends keyof Row = never, Rels extends Relationship[] = []> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: Rels;
};

/** Foreign key descriptor so supabase-js can type embedded selects like `orders(*, order_items(*))`. */
type FK<Name extends string, Col extends string, Ref extends string> = {
  foreignKeyName: Name;
  columns: [Col];
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

export type AdminUserRow = {
  user_id: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CategoryRow = {
  id: string;
  slug: string;
  name_he: string;
  name_en: string | null;
  description_he: string | null;
  description_en: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductRow = {
  id: string;
  category_id: string | null;
  slug: string;
  name_he: string;
  name_en: string | null;
  description_he: string | null;
  description_en: string | null;
  en_translation_status: TranslationStatus;
  pricing_type: PricingType;
  base_price_agorot: number | null;
  min_quantity: number;
  max_quantity: number | null;
  is_featured: boolean;
  is_available: boolean;
  allow_notes: boolean;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductImageRow = {
  id: string;
  product_id: string;
  url: string;
  storage_path: string | null;
  alt_he: string | null;
  alt_en: string | null;
  sort_order: number;
  created_at: string;
}

export type ProductVariantRow = {
  id: string;
  product_id: string;
  kind: VariantKind;
  label_he: string;
  label_en: string | null;
  min_quantity: number | null;
  price_agorot: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProductTranslationRow = {
  id: string;
  product_id: string;
  locale: "he" | "en";
  name: string;
  description: string | null;
  source: "manual" | "auto";
  approved: boolean;
  created_at: string;
}

export type DeliveryCityRow = {
  id: string;
  name_he: string;
  name_en: string | null;
  fee_agorot: number;
  is_active: boolean;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BusinessHoursRow = {
  id: string;
  day_of_week: number;
  kind: FulfillmentType;
  open_time: string;
  close_time: string;
  is_active: boolean;
}

export type AvailabilityRulesRow = {
  id: number;
  min_lead_days: number;
  max_days_ahead: number;
  slot_minutes: number;
  default_daily_limit: number;
  pending_hold_hours: number;
  updated_at: string;
}

export type BlockedDateRow = {
  id: string;
  date: string;
  reason: string | null;
  created_at: string;
}

export type BlockedTimeSlotRow = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  kind: FulfillmentType | null;
  reason: string | null;
  created_at: string;
}

export type DailyOrderLimitRow = {
  date: string;
  max_orders: number;
  updated_at: string;
}

export type CouponRow = {
  id: string;
  code: string;
  discount_type: DiscountType;
  value: number;
  scope: CouponScope;
  product_id: string | null;
  category_id: string | null;
  min_order_agorot: number;
  starts_at: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  is_active: boolean;
  terms_he: string | null;
  terms_en: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderRow = {
  id: string;
  order_number: number;
  public_token: string;
  idempotency_key: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  locale: "he" | "en";
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  fulfillment: FulfillmentType;
  delivery_city_id: string | null;
  delivery_city_name: string | null;
  delivery_address: string | null;
  city: string | null;
  scheduled_date: string;
  scheduled_time: string;
  notes: string | null;
  subtotal_agorot: number;
  discount_agorot: number;
  delivery_fee_agorot: number;
  total_agorot: number;
  has_custom_pricing: boolean;
  coupon_id: string | null;
  coupon_code: string | null;
  whatsapp_message: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name_he: string;
  product_name_en: string | null;
  variant_label_he: string | null;
  variant_label_en: string | null;
  quantity: number;
  unit_price_agorot: number | null;
  line_total_agorot: number | null;
  is_custom_price: boolean;
  notes: string | null;
  snapshot: Json;
  created_at: string;
}

export type OrderStatusHistoryRow = {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export type PaymentRow = {
  id: string;
  order_id: string;
  kind: PaymentKind;
  amount_agorot: number;
  method: PaymentMethod;
  paid_at: string;
  note: string | null;
  is_deposit: boolean;
  created_by: string | null;
  created_at: string;
}

export type CouponRedemptionRow = {
  id: string;
  coupon_id: string;
  order_id: string;
  released_at: string | null;
  created_at: string;
}

export type BusinessSettingsRow = {
  id: number;
  business_name: string;
  tagline: string;
  logo_url: string | null;
  whatsapp_phone: string | null;
  business_email: string | null;
  pickup_address_he: string | null;
  pickup_address_en: string | null;
  opening_hours_he: string | null;
  opening_hours_en: string | null;
  delivery_info_he: string | null;
  delivery_info_en: string | null;
  announcement_he: string | null;
  announcement_en: string | null;
  announcement_active: boolean;
  social_links: Json;
  currency: string;
  timezone: string;
  updated_at: string;
}

export type HomepageContentRow = {
  id: number;
  hero_image_url: string | null;
  hero_title_he: string | null;
  hero_title_en: string | null;
  hero_subtitle_he: string | null;
  hero_subtitle_en: string | null;
  about_title_he: string | null;
  about_title_en: string | null;
  about_he: string | null;
  about_en: string | null;
  about_image_url: string | null;
  updated_at: string;
}

export type GalleryImageRow = {
  id: string;
  url: string;
  storage_path: string | null;
  alt_he: string | null;
  alt_en: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export type NotificationRow = {
  id: string;
  type: string;
  channel: NotificationChannel;
  order_id: string | null;
  payload: Json;
  status: NotificationStatus;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  sent_at: string | null;
  is_read: boolean;
  created_at: string;
}

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before_data: Json | null;
  after_data: Json | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      admin_users: Table<AdminUserRow, "user_id" | "email">;
      categories: Table<CategoryRow, "slug" | "name_he">;
      products: Table<ProductRow, "slug" | "name_he", [FK<"products_category_id_fkey", "category_id", "categories">]>;
      product_images: Table<ProductImageRow, "product_id" | "url", [FK<"product_images_product_id_fkey", "product_id", "products">]>;
      product_variants: Table<ProductVariantRow, "product_id" | "kind" | "label_he" | "price_agorot", [FK<"product_variants_product_id_fkey", "product_id", "products">]>;
      product_translations: Table<ProductTranslationRow, "product_id" | "locale" | "name", [FK<"product_translations_product_id_fkey", "product_id", "products">]>;
      delivery_cities: Table<DeliveryCityRow, "name_he">;
      business_hours: Table<BusinessHoursRow, "day_of_week" | "kind" | "open_time" | "close_time">;
      availability_rules: Table<AvailabilityRulesRow>;
      blocked_dates: Table<BlockedDateRow, "date">;
      blocked_time_slots: Table<BlockedTimeSlotRow, "date" | "start_time" | "end_time">;
      daily_order_limits: Table<DailyOrderLimitRow, "date" | "max_orders">;
      coupons: Table<CouponRow, "code" | "discount_type", [FK<"coupons_product_id_fkey", "product_id", "products">, FK<"coupons_category_id_fkey", "category_id", "categories">]>;
      orders: Table<
        OrderRow,
        "idempotency_key" | "customer_name" | "customer_phone" | "fulfillment" | "scheduled_date" | "scheduled_time",
        [FK<"orders_delivery_city_id_fkey", "delivery_city_id", "delivery_cities">, FK<"orders_coupon_id_fkey", "coupon_id", "coupons">]
      >;
      order_items: Table<OrderItemRow, "order_id" | "product_name_he" | "quantity", [FK<"order_items_order_id_fkey", "order_id", "orders">, FK<"order_items_product_id_fkey", "product_id", "products">]>;
      order_status_history: Table<OrderStatusHistoryRow, "order_id" | "to_status", [FK<"order_status_history_order_id_fkey", "order_id", "orders">]>;
      payments: Table<PaymentRow, "order_id" | "amount_agorot" | "method", [FK<"payments_order_id_fkey", "order_id", "orders">]>;
      coupon_redemptions: Table<CouponRedemptionRow, "coupon_id" | "order_id", [FK<"coupon_redemptions_coupon_id_fkey", "coupon_id", "coupons">, FK<"coupon_redemptions_order_id_fkey", "order_id", "orders">]>;
      business_settings: Table<BusinessSettingsRow>;
      homepage_content: Table<HomepageContentRow>;
      gallery_images: Table<GalleryImageRow, "url">;
      notifications: Table<NotificationRow, "type" | "channel", [FK<"notifications_order_id_fkey", "order_id", "orders">]>;
      audit_logs: Table<AuditLogRow, "action" | "entity">;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      business_today: { Args: Record<string, never>; Returns: string };
      capacity_used: { Args: { p_date: string }; Returns: number };
      capacity_limit: { Args: { p_date: string }; Returns: number };
      get_availability: {
        Args: { p_from: string; p_to: string; p_kind: FulfillmentType };
        Returns: { date: string; open_time: string | null; close_time: string | null; is_available: boolean; reason: string | null }[];
      };
      validate_coupon: { Args: { p_code: string; p_subtotal_agorot: number }; Returns: Json };
      create_order: { Args: { payload: Json }; Returns: Json };
      log_audit: {
        Args: { p_action: string; p_entity: string; p_entity_id: string | null; p_before: Json | null; p_after: Json | null };
        Returns: undefined;
      };
      dashboard_stats: { Args: Record<string, never>; Returns: Json };
    };
    Enums: {
      pricing_type: PricingType;
      variant_kind: VariantKind;
      translation_status: TranslationStatus;
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      fulfillment_type: FulfillmentType;
      payment_kind: PaymentKind;
      payment_method: PaymentMethod;
      discount_type: DiscountType;
      coupon_scope: CouponScope;
      notification_status: NotificationStatus;
      notification_channel: NotificationChannel;
      admin_role: AdminRole;
    };
    CompositeTypes: Record<string, never>;
  };
}
