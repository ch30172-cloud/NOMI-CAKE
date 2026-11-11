"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface CartItem {
  key: string; // productId + variantId
  productId: string;
  slug: string;
  variantId: string | null;
  nameHe: string;
  nameEn: string | null;
  variantHe: string | null;
  variantEn: string | null;
  imageUrl: string | null;
  quantity: number;
  notes: string;
}

interface CartState {
  items: CartItem[];
  couponCode: string | null;
}

interface CartContextValue extends CartState {
  hydrated: boolean;
  addItem: (item: Omit<CartItem, "key">) => void;
  updateQuantity: (key: string, quantity: number) => void;
  updateNotes: (key: string, notes: string) => void;
  removeItem: (key: string) => void;
  setCoupon: (code: string | null) => void;
  clear: () => void;
  count: number;
}

const STORAGE_KEY = "nomi-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>({ items: [], couponCode: null });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartState;
        if (Array.isArray(parsed.items)) setState({ items: parsed.items, couponCode: parsed.couponCode ?? null });
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage may be unavailable */
    }
  }, [state, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "key">) => {
    const key = `${item.productId}:${item.variantId ?? "-"}`;
    setState((s) => {
      const existing = s.items.find((i) => i.key === key);
      if (existing) {
        return {
          ...s,
          items: s.items.map((i) =>
            i.key === key ? { ...i, quantity: i.quantity + item.quantity, notes: item.notes || i.notes } : i
          ),
        };
      }
      return { ...s, items: [...s.items, { ...item, key }] };
    });
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setState((s) => ({ ...s, items: s.items.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, quantity) } : i)) }));
  }, []);

  const updateNotes = useCallback((key: string, notes: string) => {
    setState((s) => ({ ...s, items: s.items.map((i) => (i.key === key ? { ...i, notes } : i)) }));
  }, []);

  const removeItem = useCallback((key: string) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => i.key !== key) }));
  }, []);

  const setCoupon = useCallback((code: string | null) => {
    setState((s) => ({ ...s, couponCode: code ? code.trim().toUpperCase() : null }));
  }, []);

  const clear = useCallback(() => setState({ items: [], couponCode: null }), []);

  const value = useMemo<CartContextValue>(
    () => ({
      ...state,
      hydrated,
      addItem,
      updateQuantity,
      updateNotes,
      removeItem,
      setCoupon,
      clear,
      count: state.items.reduce((n, i) => n + i.quantity, 0),
    }),
    [state, hydrated, addItem, updateQuantity, updateNotes, removeItem, setCoupon, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
