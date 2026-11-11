"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/pricing/money";
import type { CartQuote } from "@/lib/orders/actions";

export function CartSummary({ quote, showDelivery }: { quote: CartQuote; showDelivery: boolean }) {
  const t = useTranslations("cart");
  const locale = useLocale();
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between">
        <dt>{t("subtotal")}</dt>
        <dd>{formatMoney(quote.subtotalAgorot, locale)}</dd>
      </div>
      {quote.discountAgorot > 0 && (
        <div className="flex justify-between text-accent">
          <dt>
            {t("discount")} {quote.coupon?.code && <span className="text-xs">({quote.coupon.code})</span>}
          </dt>
          <dd>-{formatMoney(quote.discountAgorot, locale)}</dd>
        </div>
      )}
      {showDelivery && (
        <div className="flex justify-between">
          <dt>{t("delivery")}</dt>
          <dd>{formatMoney(quote.deliveryFeeAgorot, locale)}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-rose/20 pt-2 text-base font-semibold">
        <dt>{quote.hasCustomPricing ? t("partialTotal") : t("total")}</dt>
        <dd>{formatMoney(quote.totalAgorot, locale)}</dd>
      </div>
      {quote.hasCustomPricing && <p className="rounded-lg bg-blush/50 p-2 text-xs text-foreground/80">{t("customPricingNotice")}</p>}
    </dl>
  );
}
