"use client";

import { useEffect, useRef, useState } from "react";
import { quoteCart, type CartQuote } from "@/lib/orders/actions";
import { useCart } from "./cart-context";

/** Re-prices the cart on the server whenever items / coupon / city change (debounced). */
export function useCartQuote(deliveryCityId: string | null) {
  const { items, couponCode, hydrated } = useCart();
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  const signature = JSON.stringify({ items: items.map((i) => [i.key, i.quantity, i.notes]), couponCode, deliveryCityId });

  useEffect(() => {
    if (!hydrated) return;
    const id = ++seq.current;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const q = await quoteCart({
          items: items.map((i) => ({ key: i.key, productId: i.productId, variantId: i.variantId, quantity: i.quantity, notes: i.notes })),
          couponCode,
          deliveryCityId,
        });
        if (id === seq.current) setQuote(q);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, hydrated]);

  return { quote, loading };
}
