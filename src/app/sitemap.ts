import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/data/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const staticPaths = ["", "/products", "/privacy"];
  const entries: MetadataRoute.Sitemap = [];
  for (const p of staticPaths) {
    entries.push({
      url: `${base}/he${p}`,
      changeFrequency: p === "" ? "weekly" : "daily",
      priority: p === "" ? 1 : 0.8,
      alternates: { languages: { he: `${base}/he${p}`, en: `${base}/en${p}` } },
    });
  }
  try {
    const products = await getProducts();
    for (const pr of products) {
      entries.push({
        url: `${base}/he/products/${pr.slug}`,
        lastModified: pr.updated_at,
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: { languages: { he: `${base}/he/products/${pr.slug}`, en: `${base}/en/products/${pr.slug}` } },
      });
    }
  } catch {
    // Supabase not configured yet: static entries only.
  }
  return entries;
}
