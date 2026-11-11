"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart/cart-context";

/** Empties the local cart once the order confirmation page is shown. */
export function ClearCartOnMount() {
  const { clear, hydrated, items } = useCart();
  useEffect(() => {
    if (hydrated && items.length > 0) clear();
  }, [hydrated, items.length, clear]);
  return null;
}
