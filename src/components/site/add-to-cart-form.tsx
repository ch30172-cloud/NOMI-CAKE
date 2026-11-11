"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useCart } from "@/components/cart/cart-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/pricing/money";
import { priceLine, type PricingVariant } from "@/lib/pricing/pricing";
import { cn } from "@/lib/utils";
import type { PricingType } from "@/types/database";

interface ProductInput {
  id: string;
  slug: string;
  category_id: string | null;
  name_he: string;
  name_en: string | null;
  pricing_type: PricingType;
  base_price_agorot: number | null;
  min_quantity: number;
  max_quantity: number | null;
  is_available: boolean;
  allow_notes: boolean;
  imageUrl: string | null;
}

type VariantInput = PricingVariant & { label_he: string; label_en: string | null };

export function AddToCartForm({ product, variants }: { product: ProductInput; variants: VariantInput[] }) {
  const t = useTranslations("product");
  const tc = useTranslations("catalog");
  const locale = useLocale();
  const router = useRouter();
  const { addItem } = useCart();
  const sizes = variants.filter((v) => v.kind === "size");
  const tiers = variants.filter((v) => v.kind === "quantity_tier").sort((a, b) => (a.min_quantity ?? 0) - (b.min_quantity ?? 0));
  const [variantId, setVariantId] = useState<string | null>(sizes.length === 1 ? sizes[0].id : null);
  const [quantity, setQuantity] = useState(product.min_quantity);
  const [notes, setNotes] = useState("");

  const line = useMemo(() => {
    try {
      return priceLine({ product, variant: sizes.find((v) => v.id === variantId) ?? null, variants, quantity });
    } catch {
      return null;
    }
  }, [product, sizes, variants, variantId, quantity]);

  const label = (v: VariantInput) => (locale === "en" && v.label_en ? v.label_en : v.label_he);
  const needsSize = product.pricing_type === "by_size" && !variantId;
  const disabled = !product.is_available || needsSize || (product.pricing_type !== "custom" && !line);

  function submit() {
    const v = sizes.find((s) => s.id === variantId) ?? null;
    addItem({
      productId: product.id,
      slug: product.slug,
      variantId: v?.id ?? null,
      nameHe: product.name_he,
      nameEn: product.name_en,
      variantHe: v?.label_he ?? null,
      variantEn: v?.label_en ?? null,
      imageUrl: product.imageUrl,
      quantity,
      notes: notes.trim(),
    });
    toast.success(tc("added"), { action: { label: tc("viewProduct") === "" ? "" : t("addToCart"), onClick: () => router.push("/cart") } });
    router.push("/cart");
  }

  if (!product.is_available) {
    return <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("unavailable")}</p>;
  }

  return (
    <div className="space-y-6">
      {product.pricing_type === "by_size" && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("chooseSize")}</legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariantId(v.id)}
                aria-pressed={variantId === v.id}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition-colors",
                  variantId === v.id ? "border-accent bg-accent text-accent-foreground" : "border-rose/40 bg-white hover:bg-secondary"
                )}
              >
                {label(v)} · {formatMoney(v.price_agorot, locale)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {product.pricing_type === "by_quantity" && tiers.length > 0 && (
        <div className="rounded-xl bg-blush/40 p-3 text-sm">
          <p className="mb-1 font-medium">{t("tiers")}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            {product.base_price_agorot !== null && (
              <li>
                {formatMoney(product.base_price_agorot, locale)} {tc("perUnit")}
              </li>
            )}
            {tiers.map((v) => (
              <li key={v.id}>
                {t("fromQty", { qty: v.min_quantity ?? 0 })}: {formatMoney(v.price_agorot, locale)} {tc("perUnit")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {product.pricing_type === "custom" && <p className="rounded-xl bg-blush/40 p-3 text-sm">{t("customPriceNote")}</p>}

      <div>
        <Label className="mb-2 block">{t("quantity")}</Label>
        <div className="inline-flex items-center rounded-full border border-rose/40 bg-white">
          <button type="button" className="px-3 py-2" aria-label="-" onClick={() => setQuantity((q) => Math.max(product.min_quantity, q - 1))}>
            <Minus className="size-4" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            className="w-14 bg-transparent text-center outline-none"
            value={quantity}
            min={product.min_quantity}
            max={product.max_quantity ?? undefined}
            onChange={(e) => setQuantity(Math.max(product.min_quantity, Number(e.target.value) || product.min_quantity))}
            aria-label={t("quantity")}
          />
          <button
            type="button"
            className="px-3 py-2"
            aria-label="+"
            onClick={() => setQuantity((q) => (product.max_quantity ? Math.min(product.max_quantity, q + 1) : q + 1))}
          >
            <Plus className="size-4" />
          </button>
        </div>
        {product.min_quantity > 1 && <p className="mt-1 text-xs text-muted-foreground">{t("minQuantity", { min: product.min_quantity })}</p>}
      </div>

      {product.allow_notes && (
        <div>
          <Label htmlFor="notes" className="mb-2 block">
            {t("notes")}
          </Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPlaceholder")} maxLength={500} className="bg-white" />
        </div>
      )}

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-cream p-4">
        <div>
          <p className="text-xs text-muted-foreground">{t("lineTotal")}</p>
          <p className="text-2xl font-medium text-accent">
            {product.pricing_type === "custom" || !line || line.lineTotalAgorot === null ? tc("customPrice") : formatMoney(line.lineTotalAgorot, locale)}
          </p>
        </div>
        <Button size="lg" className="rounded-full px-6" disabled={disabled} onClick={submit}>
          <ShoppingBag className="size-5" aria-hidden />
          {t("addToCart")}
        </Button>
      </div>
    </div>
  );
}
