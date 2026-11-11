"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/components/cart/cart-context";

export function CartButton() {
  const { count, hydrated } = useCart();
  const t = useTranslations("nav");
  return (
    <Link
      href="/cart"
      aria-label={t("cart")}
      className="relative inline-flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
    >
      <ShoppingBag className="size-5" aria-hidden />
      {hydrated && count > 0 && (
        <span className="absolute -top-0.5 -end-0.5 flex min-w-5 h-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-accent-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}
