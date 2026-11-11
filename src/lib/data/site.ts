import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  BusinessSettingsRow,
  CategoryRow,
  DeliveryCityRow,
  GalleryImageRow,
  HomepageContentRow,
  ProductImageRow,
  ProductRow,
  ProductVariantRow,
} from "@/types/database";

/**
 * Public data access (anon RLS applies). Every function degrades to empty data
 * when Supabase is not configured so the site still renders during setup.
 */

export const getBusinessSettings = cache(async (): Promise<BusinessSettingsRow | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("business_settings").select("*").eq("id", 1).maybeSingle();
  return data;
});

export const getHomepageContent = cache(async (): Promise<HomepageContentRow | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("homepage_content").select("*").eq("id", 1).maybeSingle();
  return data;
});

export const getCategories = cache(async (): Promise<CategoryRow[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order");
  return data ?? [];
});

export type ProductWithRelations = ProductRow & {
  product_images: ProductImageRow[];
  product_variants: ProductVariantRow[];
  categories: Pick<CategoryRow, "id" | "slug" | "name_he" | "name_en"> | null;
};

const PRODUCT_SELECT = "*, product_images(*), product_variants(*), categories(id, slug, name_he, name_en)";

export const getProducts = cache(
  async (opts: { categorySlug?: string; search?: string; featuredOnly?: boolean } = {}): Promise<ProductWithRelations[]> => {
    if (!isSupabaseConfigured()) return [];
    const supabase = await createClient();
    let q = supabase.from("products").select(PRODUCT_SELECT).is("deleted_at", null).order("sort_order");
    if (opts.featuredOnly) q = q.eq("is_featured", true).eq("is_available", true);
    if (opts.search) {
      const s = opts.search.replace(/[%,()]/g, " ").trim();
      if (s) q = q.or(`name_he.ilike.%${s}%,name_en.ilike.%${s}%,description_he.ilike.%${s}%,description_en.ilike.%${s}%`);
    }
    const { data } = await q;
    let rows = (data ?? []) as unknown as ProductWithRelations[];
    if (opts.categorySlug) rows = rows.filter((p) => p.categories?.slug === opts.categorySlug);
    for (const p of rows) {
      p.product_images.sort((a, b) => a.sort_order - b.sort_order);
      p.product_variants = p.product_variants.filter((v) => v.is_active).sort((a, b) => a.sort_order - b.sort_order);
    }
    return rows;
  }
);

export const getProductBySlug = cache(async (slug: string): Promise<ProductWithRelations | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("products").select(PRODUCT_SELECT).eq("slug", slug).is("deleted_at", null).maybeSingle();
  if (!data) return null;
  const p = data as unknown as ProductWithRelations;
  p.product_images.sort((a, b) => a.sort_order - b.sort_order);
  p.product_variants = p.product_variants.filter((v) => v.is_active).sort((a, b) => a.sort_order - b.sort_order);
  return p;
});

export const getGallery = cache(async (): Promise<GalleryImageRow[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("gallery_images").select("*").eq("is_active", true).order("sort_order");
  return data ?? [];
});

export const getDeliveryCities = cache(async (): Promise<DeliveryCityRow[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("delivery_cities").select("*").eq("is_active", true).is("deleted_at", null).order("sort_order");
  return data ?? [];
});

/** Lowest price shown as "from" on cards; null when custom. */
export function displayPriceAgorot(p: ProductWithRelations): { from: boolean; agorot: number | null } {
  switch (p.pricing_type) {
    case "fixed":
      return { from: false, agorot: p.base_price_agorot };
    case "custom":
      return { from: false, agorot: null };
    case "by_size": {
      const prices = p.product_variants.filter((v) => v.kind === "size").map((v) => v.price_agorot);
      return { from: prices.length > 1, agorot: prices.length ? Math.min(...prices) : null };
    }
    case "by_quantity": {
      const prices = p.product_variants.filter((v) => v.kind === "quantity_tier").map((v) => v.price_agorot);
      if (p.base_price_agorot !== null) prices.push(p.base_price_agorot);
      return { from: true, agorot: prices.length ? Math.min(...prices) : null };
    }
  }
}

export function localized<T extends object>(row: T, field: string, locale: string): string {
  const r = row as Record<string, unknown>;
  const he = r[`${field}_he`] as string | null | undefined;
  const en = r[`${field}_en`] as string | null | undefined;
  if (locale === "en" && en) return en;
  return he ?? en ?? "";
}
