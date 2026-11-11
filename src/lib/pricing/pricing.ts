/**
 * Pure pricing rules. Mirrors the authoritative implementation in
 * supabase/migrations/0003_functions.sql (create_order). Used for cart display
 * and tested in tests/pricing.test.ts. All amounts are integer agorot.
 */
import type { CouponScope, DiscountType, PricingType, VariantKind } from "@/types/database";

export interface PricingProduct {
  id: string;
  category_id: string | null;
  pricing_type: PricingType;
  base_price_agorot: number | null;
  min_quantity: number;
  max_quantity: number | null;
  is_available: boolean;
}

export interface PricingVariant {
  id: string;
  product_id: string;
  kind: VariantKind;
  min_quantity: number | null;
  price_agorot: number;
  is_active: boolean;
}

export interface PricingCoupon {
  code: string;
  discount_type: DiscountType;
  value: number;
  scope: CouponScope;
  product_id: string | null;
  category_id: string | null;
  min_order_agorot: number;
}

export interface LineInput {
  product: PricingProduct;
  variant?: PricingVariant | null;
  variants?: PricingVariant[]; // all variants of the product (needed for quantity tiers)
  quantity: number;
}

export interface LineResult {
  unitPriceAgorot: number | null;
  lineTotalAgorot: number | null;
  isCustomPrice: boolean;
  appliedVariantId: string | null;
}

export class PricingError extends Error {
  constructor(public code: string, public productId?: string) {
    super(code);
  }
}

export function pickQuantityTier(variants: PricingVariant[], quantity: number): PricingVariant | null {
  const tiers = variants
    .filter((v) => v.kind === "quantity_tier" && v.is_active && v.min_quantity !== null && v.min_quantity <= quantity)
    .sort((a, b) => (b.min_quantity ?? 0) - (a.min_quantity ?? 0));
  return tiers[0] ?? null;
}

export function priceLine(input: LineInput): LineResult {
  const { product, quantity } = input;
  if (!Number.isInteger(quantity) || quantity < 1) throw new PricingError("invalid_quantity", product.id);
  if (!product.is_available) throw new PricingError("product_unavailable", product.id);
  if (quantity < product.min_quantity) throw new PricingError("quantity_below_min", product.id);
  if (product.max_quantity !== null && quantity > product.max_quantity) {
    throw new PricingError("quantity_above_max", product.id);
  }

  switch (product.pricing_type) {
    case "fixed": {
      if (product.base_price_agorot === null) throw new PricingError("missing_price", product.id);
      return {
        unitPriceAgorot: product.base_price_agorot,
        lineTotalAgorot: product.base_price_agorot * quantity,
        isCustomPrice: false,
        appliedVariantId: null,
      };
    }
    case "by_size": {
      const v = input.variant;
      if (!v || v.kind !== "size" || !v.is_active || v.product_id !== product.id) {
        throw new PricingError("size_required", product.id);
      }
      return { unitPriceAgorot: v.price_agorot, lineTotalAgorot: v.price_agorot * quantity, isCustomPrice: false, appliedVariantId: v.id };
    }
    case "by_quantity": {
      const tier = pickQuantityTier(input.variants ?? [], quantity);
      const unit = tier ? tier.price_agorot : product.base_price_agorot;
      if (unit === null) throw new PricingError("no_tier", product.id);
      return { unitPriceAgorot: unit, lineTotalAgorot: unit * quantity, isCustomPrice: false, appliedVariantId: tier?.id ?? null };
    }
    case "custom":
      return { unitPriceAgorot: null, lineTotalAgorot: null, isCustomPrice: true, appliedVariantId: null };
  }
}

export interface CartTotalsInput {
  lines: Array<{ product: PricingProduct; lineTotalAgorot: number | null }>;
  coupon?: PricingCoupon | null;
  deliveryFeeAgorot: number; // 0 for pickup
}

export interface CartTotals {
  subtotalAgorot: number;
  discountAgorot: number;
  deliveryFeeAgorot: number;
  totalAgorot: number;
  hasCustomPricing: boolean;
  couponError: string | null;
}

export function couponEligibleAmount(coupon: PricingCoupon, lines: CartTotalsInput["lines"]): number {
  return lines.reduce((sum, l) => {
    if (l.lineTotalAgorot === null) return sum;
    const eligible =
      coupon.scope === "order" ||
      (coupon.scope === "product" && coupon.product_id === l.product.id) ||
      (coupon.scope === "category" && coupon.category_id !== null && coupon.category_id === l.product.category_id);
    return eligible ? sum + l.lineTotalAgorot : sum;
  }, 0);
}

export function computeDiscount(coupon: PricingCoupon, eligibleAgorot: number, deliveryFeeAgorot: number): number {
  switch (coupon.discount_type) {
    case "percent":
      return Math.floor((eligibleAgorot * coupon.value) / 100);
    case "fixed":
      return Math.min(coupon.value, eligibleAgorot);
    case "free_delivery":
      return deliveryFeeAgorot;
  }
}

export function computeCartTotals(input: CartTotalsInput): CartTotals {
  const subtotal = input.lines.reduce((s, l) => s + (l.lineTotalAgorot ?? 0), 0);
  const hasCustomPricing = input.lines.some((l) => l.lineTotalAgorot === null);
  let discount = 0;
  let couponError: string | null = null;
  if (input.coupon) {
    if (subtotal < input.coupon.min_order_agorot) {
      couponError = "min_order";
    } else {
      discount = computeDiscount(input.coupon, couponEligibleAmount(input.coupon, input.lines), input.deliveryFeeAgorot);
    }
  }
  const total = Math.max(subtotal + input.deliveryFeeAgorot - discount, 0);
  return {
    subtotalAgorot: subtotal,
    discountAgorot: discount,
    deliveryFeeAgorot: input.deliveryFeeAgorot,
    totalAgorot: total,
    hasCustomPricing,
    couponError,
  };
}
