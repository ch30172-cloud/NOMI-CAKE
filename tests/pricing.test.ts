import { describe, expect, it } from "vitest";
import {
  computeCartTotals,
  pickQuantityTier,
  priceLine,
  PricingError,
  type PricingProduct,
  type PricingVariant,
} from "@/lib/pricing/pricing";

const base: PricingProduct = {
  id: "p1",
  category_id: "c1",
  pricing_type: "fixed",
  base_price_agorot: 12000,
  min_quantity: 1,
  max_quantity: null,
  is_available: true,
};

const sizes: PricingVariant[] = [
  { id: "s", product_id: "p2", kind: "size", min_quantity: null, price_agorot: 18000, is_active: true },
  { id: "m", product_id: "p2", kind: "size", min_quantity: null, price_agorot: 24000, is_active: true },
  { id: "l", product_id: "p2", kind: "size", min_quantity: null, price_agorot: 32000, is_active: false },
];

const tiers: PricingVariant[] = [
  { id: "t6", product_id: "p3", kind: "quantity_tier", min_quantity: 6, price_agorot: 1500, is_active: true },
  { id: "t12", product_id: "p3", kind: "quantity_tier", min_quantity: 12, price_agorot: 1300, is_active: true },
  { id: "t24", product_id: "p3", kind: "quantity_tier", min_quantity: 24, price_agorot: 1100, is_active: true },
];

describe("priceLine", () => {
  it("fixed price multiplies by quantity", () => {
    expect(priceLine({ product: base, quantity: 3 })).toEqual({
      unitPriceAgorot: 12000,
      lineTotalAgorot: 36000,
      isCustomPrice: false,
      appliedVariantId: null,
    });
  });

  it("by_size uses the chosen size and rejects inactive / missing sizes", () => {
    const p: PricingProduct = { ...base, id: "p2", pricing_type: "by_size", base_price_agorot: null };
    expect(priceLine({ product: p, variant: sizes[1], quantity: 2 }).lineTotalAgorot).toBe(48000);
    expect(() => priceLine({ product: p, quantity: 1 })).toThrow(PricingError);
    expect(() => priceLine({ product: p, variant: sizes[2], quantity: 1 })).toThrow("size_required");
  });

  it("by_quantity picks the highest tier at or below the quantity", () => {
    const p: PricingProduct = { ...base, id: "p3", pricing_type: "by_quantity", base_price_agorot: 1800, min_quantity: 1 };
    expect(pickQuantityTier(tiers, 5)).toBeNull();
    expect(priceLine({ product: p, variants: tiers, quantity: 5 }).unitPriceAgorot).toBe(1800); // base fallback
    expect(priceLine({ product: p, variants: tiers, quantity: 6 }).unitPriceAgorot).toBe(1500);
    expect(priceLine({ product: p, variants: tiers, quantity: 13 }).lineTotalAgorot).toBe(13 * 1300);
    expect(priceLine({ product: p, variants: tiers, quantity: 100 }).unitPriceAgorot).toBe(1100);
  });

  it("by_quantity without base price and below the lowest tier fails", () => {
    const p: PricingProduct = { ...base, id: "p3", pricing_type: "by_quantity", base_price_agorot: null };
    expect(() => priceLine({ product: p, variants: tiers, quantity: 2 })).toThrow("no_tier");
  });

  it("custom pricing yields null totals", () => {
    const p: PricingProduct = { ...base, pricing_type: "custom", base_price_agorot: null };
    expect(priceLine({ product: p, quantity: 1 })).toMatchObject({ lineTotalAgorot: null, isCustomPrice: true });
  });

  it("enforces availability and quantity bounds", () => {
    expect(() => priceLine({ product: { ...base, is_available: false }, quantity: 1 })).toThrow("product_unavailable");
    expect(() => priceLine({ product: { ...base, min_quantity: 4 }, quantity: 3 })).toThrow("quantity_below_min");
    expect(() => priceLine({ product: { ...base, max_quantity: 2 }, quantity: 3 })).toThrow("quantity_above_max");
    expect(() => priceLine({ product: base, quantity: 0 })).toThrow("invalid_quantity");
    expect(() => priceLine({ product: base, quantity: 1.5 })).toThrow("invalid_quantity");
  });
});

describe("computeCartTotals", () => {
  const lines = [
    { product: base, lineTotalAgorot: 36000 },
    { product: { ...base, id: "p9", category_id: "c2" }, lineTotalAgorot: 10000 },
  ];

  it("sums subtotal, delivery and no coupon", () => {
    expect(computeCartTotals({ lines, deliveryFeeAgorot: 3000 })).toMatchObject({
      subtotalAgorot: 46000,
      discountAgorot: 0,
      totalAgorot: 49000,
      hasCustomPricing: false,
    });
  });

  it("percent coupon on the whole order floors to agorot", () => {
    const coupon = { code: "X", discount_type: "percent" as const, value: 15, scope: "order" as const, product_id: null, category_id: null, min_order_agorot: 0 };
    const r = computeCartTotals({ lines, coupon, deliveryFeeAgorot: 0 });
    expect(r.discountAgorot).toBe(Math.floor(46000 * 0.15));
    expect(r.totalAgorot).toBe(46000 - 6900);
  });

  it("fixed coupon never exceeds the eligible amount", () => {
    const coupon = { code: "X", discount_type: "fixed" as const, value: 99999, scope: "product" as const, product_id: "p9", category_id: null, min_order_agorot: 0 };
    expect(computeCartTotals({ lines, coupon, deliveryFeeAgorot: 0 }).discountAgorot).toBe(10000);
  });

  it("category coupon only applies to matching lines", () => {
    const coupon = { code: "X", discount_type: "percent" as const, value: 50, scope: "category" as const, product_id: null, category_id: "c2", min_order_agorot: 0 };
    expect(computeCartTotals({ lines, coupon, deliveryFeeAgorot: 0 }).discountAgorot).toBe(5000);
  });

  it("free delivery coupon discounts exactly the delivery fee", () => {
    const coupon = { code: "X", discount_type: "free_delivery" as const, value: 0, scope: "order" as const, product_id: null, category_id: null, min_order_agorot: 0 };
    const r = computeCartTotals({ lines, coupon, deliveryFeeAgorot: 3500 });
    expect(r.discountAgorot).toBe(3500);
    expect(r.totalAgorot).toBe(46000);
  });

  it("minimum order is enforced", () => {
    const coupon = { code: "X", discount_type: "percent" as const, value: 10, scope: "order" as const, product_id: null, category_id: null, min_order_agorot: 50000 };
    const r = computeCartTotals({ lines, coupon, deliveryFeeAgorot: 0 });
    expect(r.couponError).toBe("min_order");
    expect(r.discountAgorot).toBe(0);
  });

  it("custom-priced lines are excluded and flagged", () => {
    const r = computeCartTotals({ lines: [...lines, { product: base, lineTotalAgorot: null }], deliveryFeeAgorot: 0 });
    expect(r.subtotalAgorot).toBe(46000);
    expect(r.hasCustomPricing).toBe(true);
  });
});
