"use client";

import Image from "next/image";
import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/pricing/money";
import { useCart } from "./cart-context";
import { CartSummary } from "./cart-summary";
import { useCartQuote } from "./use-cart-quote";

export function CartView() {
  const t = useTranslations("cart");
  const tc = useTranslations("catalog");
  const locale = useLocale();
  const { items, hydrated, updateQuantity, updateNotes, removeItem, couponCode, setCoupon } = useCart();
  const { quote, loading } = useCartQuote(null);
  const [couponInput, setCouponInput] = useState(couponCode ?? "");

  if (!hydrated) return <div className="h-40 animate-pulse rounded-2xl bg-blush/40" />;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-blush/40 p-10 text-center">
        <p className="mb-4 text-muted-foreground">{t("empty")}</p>
        <Button asChild className="rounded-full">
          <Link href="/products">{t("continueShopping")}</Link>
        </Button>
      </div>
    );
  }

  const couponError = quote?.coupon && !quote.coupon.valid ? quote.coupon.reason ?? "generic" : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <ul className="space-y-4">
        {items.map((item) => {
          const line = quote?.lines.find((l) => l.key === item.key);
          const name = locale === "en" && item.nameEn ? item.nameEn : item.nameHe;
          const variant = locale === "en" && item.variantEn ? item.variantEn : item.variantHe;
          return (
            <li key={item.key} className="card-elegant flex gap-4 p-4">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-blush/40">
                {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="96px" className="object-cover" unoptimized={!item.imageUrl.startsWith("/")} />}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/products/${item.slug}`} className="font-medium hover:text-accent">
                      {name}
                    </Link>
                    {variant && <p className="text-sm text-muted-foreground">{variant}</p>}
                  </div>
                  <button type="button" onClick={() => removeItem(item.key)} aria-label={t("remove")} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {line?.error && <p className="text-sm text-destructive">{t("itemUnavailable")}</p>}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center rounded-full border border-rose/40 bg-white">
                    <button type="button" className="px-2 py-1" aria-label="-" onClick={() => updateQuantity(item.key, item.quantity - 1)}>
                      <Minus className="size-4" />
                    </button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <button type="button" className="px-2 py-1" aria-label="+" onClick={() => updateQuantity(item.key, item.quantity + 1)}>
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <p className="font-medium text-accent">
                    {line ? (line.lineTotalAgorot === null ? tc("customPrice") : formatMoney(line.lineTotalAgorot, locale)) : "…"}
                  </p>
                </div>
                <Textarea
                  value={item.notes}
                  onChange={(e) => updateNotes(item.key, e.target.value)}
                  placeholder={t("notes")}
                  rows={1}
                  maxLength={500}
                  className="min-h-9 bg-white text-sm"
                />
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="card-elegant h-fit space-y-4 p-5">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setCoupon(couponInput || null);
          }}
        >
          <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder={t("coupon")} className="bg-white uppercase" aria-label={t("coupon")} />
          <Button type="submit" variant="secondary">
            {t("applyCoupon")}
          </Button>
        </form>
        {quote?.coupon?.valid && (
          <p className="flex items-center justify-between text-sm text-accent">
            {t("couponApplied")}
            <button
              type="button"
              className="underline"
              onClick={() => {
                setCoupon(null);
                setCouponInput("");
              }}
            >
              {t("removeCoupon")}
            </button>
          </p>
        )}
        {couponError && (
          <p className="text-sm text-destructive">
            {couponError === "min_order"
              ? t("couponErrors.min_order", { min: formatMoney(quote?.coupon?.minOrderAgorot ?? 0, locale) })
              : t(`couponErrors.${["not_found", "not_started", "expired", "exhausted"].includes(couponError) ? couponError : "generic"}` as "couponErrors.generic")}
          </p>
        )}
        {quote && <CartSummary quote={quote} showDelivery={false} />}
        <Button asChild size="lg" className="w-full rounded-full" disabled={loading || !quote || quote.lines.some((l) => l.error)}>
          <Link href="/checkout">{t("checkout")}</Link>
        </Button>
        <Link href="/products" className="block text-center text-sm text-muted-foreground hover:text-accent">
          {t("continueShopping")}
        </Link>
      </aside>
    </div>
  );
}
