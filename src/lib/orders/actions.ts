"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { computeCartTotals, priceLine, type PricingCoupon } from "@/lib/pricing/pricing";
import { generateSlots } from "@/lib/availability/slots";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { sendPendingNotifications } from "@/lib/email/notifications";
import { checkoutSchema, type CheckoutInput } from "./schemas";
import type { FulfillmentType } from "@/types/database";

export interface PricedLine {
  key: string;
  productId: string;
  variantId: string | null;
  slug: string;
  nameHe: string;
  nameEn: string | null;
  variantHe: string | null;
  variantEn: string | null;
  imageUrl: string | null;
  quantity: number;
  notes: string;
  unitPriceAgorot: number | null;
  lineTotalAgorot: number | null;
  isCustomPrice: boolean;
  error: string | null;
}

export interface CartQuote {
  lines: PricedLine[];
  subtotalAgorot: number;
  discountAgorot: number;
  deliveryFeeAgorot: number;
  totalAgorot: number;
  hasCustomPricing: boolean;
  coupon: { code: string; valid: boolean; reason: string | null; minOrderAgorot?: number } | null;
}

const EMPTY_QUOTE: CartQuote = { lines: [], subtotalAgorot: 0, discountAgorot: 0, deliveryFeeAgorot: 0, totalAgorot: 0, hasCustomPricing: false, coupon: null };

/**
 * Prices the cart on the server from live DB data (anon client, RLS applies).
 * Display only: create_order() recomputes everything atomically in the database.
 */
export async function quoteCart(input: {
  items: Array<{ key: string; productId: string; variantId: string | null; quantity: number; notes: string }>;
  couponCode: string | null;
  deliveryCityId: string | null;
}): Promise<CartQuote> {
  if (!isSupabaseConfigured() || input.items.length === 0) return EMPTY_QUOTE;
  const supabase = await createClient();
  const ids = [...new Set(input.items.map((i) => i.productId))];
  const { data: products } = await supabase
    .from("products")
    .select("*, product_images(url, sort_order), product_variants(*)")
    .in("id", ids)
    .is("deleted_at", null);

  const lines: PricedLine[] = input.items.map((item) => {
    const p = products?.find((x) => x.id === item.productId);
    const base = { key: item.key, productId: item.productId, variantId: item.variantId, quantity: item.quantity, notes: item.notes };
    if (!p) {
      return { ...base, slug: "", nameHe: "", nameEn: null, variantHe: null, variantEn: null, imageUrl: null, unitPriceAgorot: null, lineTotalAgorot: null, isCustomPrice: false, error: "product_unavailable" };
    }
    const variants = p.product_variants.filter((v) => v.is_active);
    const variant = variants.find((v) => v.id === item.variantId) ?? null;
    const images = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order);
    const common = { ...base, slug: p.slug, nameHe: p.name_he, nameEn: p.name_en, variantHe: variant?.label_he ?? null, variantEn: variant?.label_en ?? null, imageUrl: images[0]?.url ?? null };
    try {
      const r = priceLine({ product: p, variant, variants, quantity: item.quantity });
      return { ...common, unitPriceAgorot: r.unitPriceAgorot, lineTotalAgorot: r.lineTotalAgorot, isCustomPrice: r.isCustomPrice, error: null };
    } catch (e) {
      return { ...common, unitPriceAgorot: null, lineTotalAgorot: null, isCustomPrice: false, error: e instanceof Error ? e.message : "error" };
    }
  });

  let deliveryFee = 0;
  if (input.deliveryCityId) {
    const { data: city } = await supabase.from("delivery_cities").select("fee_agorot").eq("id", input.deliveryCityId).eq("is_active", true).is("deleted_at", null).maybeSingle();
    deliveryFee = city?.fee_agorot ?? 0;
  }

  const validLines = lines.filter((l) => !l.error);
  const subtotal = validLines.reduce((s, l) => s + (l.lineTotalAgorot ?? 0), 0);

  let coupon: CartQuote["coupon"] = null;
  let pricingCoupon: PricingCoupon | null = null;
  if (input.couponCode) {
    const { data } = await supabase.rpc("validate_coupon", { p_code: input.couponCode, p_subtotal_agorot: subtotal });
    const v = (data ?? {}) as Record<string, unknown>;
    if (v.valid === true) {
      pricingCoupon = {
        code: String(v.code),
        discount_type: v.discount_type as PricingCoupon["discount_type"],
        value: Number(v.value),
        scope: v.scope as PricingCoupon["scope"],
        product_id: (v.product_id as string | null) ?? null,
        category_id: (v.category_id as string | null) ?? null,
        min_order_agorot: Number(v.min_order_agorot ?? 0),
      };
      coupon = { code: pricingCoupon.code, valid: true, reason: null };
    } else {
      coupon = { code: input.couponCode, valid: false, reason: (v.reason as string) ?? "generic", minOrderAgorot: v.min_order_agorot as number | undefined };
    }
  }

  const totals = computeCartTotals({
    lines: validLines.map((l) => {
      const p = products?.find((x) => x.id === l.productId);
      return {
        product: { id: l.productId, category_id: p?.category_id ?? null, pricing_type: "fixed" as const, base_price_agorot: null, min_quantity: 1, max_quantity: null, is_available: true },
        lineTotalAgorot: l.lineTotalAgorot,
      };
    }),
    coupon: pricingCoupon,
    deliveryFeeAgorot: deliveryFee,
  });

  return { lines, ...{ subtotalAgorot: totals.subtotalAgorot, discountAgorot: totals.discountAgorot, deliveryFeeAgorot: totals.deliveryFeeAgorot, totalAgorot: totals.totalAgorot, hasCustomPricing: totals.hasCustomPricing }, coupon };
}

export interface DayAvailability {
  date: string;
  openTime: string | null;
  closeTime: string | null;
  isAvailable: boolean;
  reason: string | null;
}

export async function fetchAvailability(from: string, to: string, kind: FulfillmentType): Promise<{ days: DayAvailability[]; minLeadDays: number; slotMinutes: number }> {
  if (!isSupabaseConfigured()) return { days: [], minLeadDays: 0, slotMinutes: 60 };
  const supabase = await createClient();
  const [{ data }, { data: rules }] = await Promise.all([
    supabase.rpc("get_availability", { p_from: from, p_to: to, p_kind: kind }),
    supabase.from("availability_rules").select("min_lead_days, slot_minutes").eq("id", 1).maybeSingle(),
  ]);
  return {
    days: (data ?? []).map((d) => ({ date: d.date, openTime: d.open_time, closeTime: d.close_time, isAvailable: d.is_available, reason: d.reason })),
    minLeadDays: rules?.min_lead_days ?? 0,
    slotMinutes: rules?.slot_minutes ?? 60,
  };
}

export async function fetchSlots(date: string, kind: FulfillmentType): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const [{ data: days }, { data: rules }, { data: blocked }] = await Promise.all([
    supabase.rpc("get_availability", { p_from: date, p_to: date, p_kind: kind }),
    supabase.from("availability_rules").select("slot_minutes").eq("id", 1).maybeSingle(),
    supabase.from("blocked_time_slots").select("start_time, end_time, kind").eq("date", date),
  ]);
  const day = days?.[0];
  if (!day || !day.is_available || !day.open_time || !day.close_time) return [];
  return generateSlots({ openTime: day.open_time, closeTime: day.close_time, slotMinutes: rules?.slot_minutes ?? 60, blocked: blocked ?? [], kind });
}

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: number; token: string; duplicate: boolean }
  | { ok: false; error: string; field?: string };

const KNOWN_ERRORS = new Set([
  "date_too_soon", "date_too_far", "date_blocked", "date_closed", "date_full", "time_outside_hours", "time_blocked", "time_not_aligned",
  "city_unavailable", "address_required", "product_not_found", "product_unavailable", "quantity_below_min", "quantity_above_max",
  "size_required", "no_tier", "coupon_invalid", "coupon_expired", "coupon_exhausted", "coupon_min_order", "empty_order",
]);

export async function createOrderAction(raw: CheckoutInput): Promise<CreateOrderResult> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "not_configured" };

  const ip = await clientKey();
  if (!rateLimit(`order:${ip}`, 10, 10 * 60 * 1000)) return { ok: false, error: "rate_limited" };

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "generic", field: issue?.path.join(".") };
  }
  const d = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_order", {
    payload: {
      idempotency_key: d.idempotencyKey,
      locale: d.locale,
      customer: { name: d.customer.name, phone: d.customer.phone, email: d.customer.email, city: d.customer.city },
      fulfillment: d.fulfillment,
      delivery_city_id: d.fulfillment === "delivery" ? d.deliveryCityId : null,
      delivery_address: d.fulfillment === "delivery" ? d.deliveryAddress : null,
      scheduled_date: d.scheduledDate,
      scheduled_time: d.scheduledTime,
      notes: d.notes,
      coupon_code: d.couponCode || null,
      items: d.items.map((i) => ({ product_id: i.productId, variant_id: i.variantId, quantity: i.quantity, notes: i.notes })),
    },
  });

  if (error) {
    // Business errors are raised as plain codes in 0003_functions.sql, optionally suffixed with ":<id>".
    const code = error.message.split(":")[0].trim();
    console.error("create_order failed:", error.message);
    return { ok: false, error: KNOWN_ERRORS.has(code) ? code : "generic" };
  }

  const result = data as { id: string; order_number: number; public_token: string; duplicate: boolean };

  // Best-effort immediate email; the cron route retries anything that fails.
  sendPendingNotifications().catch((e) => console.error("notification send failed", e));

  return { ok: true, orderId: result.id, orderNumber: result.order_number, token: result.public_token, duplicate: result.duplicate };
}
