import type { Metadata } from "next";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AddToCartForm } from "@/components/site/add-to-cart-form";
import { Badge } from "@/components/ui/badge";
import { getProductBySlug, localized } from "@/lib/data/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  const name = localized(product, "name", locale);
  const description = localized(product, "description", locale);
  return {
    title: name,
    description: description || undefined,
    openGraph: { title: name, description: description || undefined, images: product.product_images[0] ? [{ url: product.product_images[0].url }] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const t = await getTranslations("product");
  const tc = await getTranslations("catalog");
  const currentLocale = await getLocale();
  const name = localized(product, "name", currentLocale);
  const description = localized(product, "description", currentLocale);
  const Arrow = currentLocale === "he" ? ArrowRight : ArrowLeft;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/products" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent">
        <Arrow className="size-4" aria-hidden /> {t("backToCatalog")}
      </Link>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-blush/40">
            {product.product_images[0] ? (
              <Image
                src={product.product_images[0].url}
                alt={localized(product.product_images[0], "alt", currentLocale) || name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                unoptimized={!product.product_images[0].url.startsWith("/")}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-7xl" aria-hidden>
                🎂
              </div>
            )}
          </div>
          {product.product_images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.product_images.slice(1, 5).map((img) => (
                <div key={img.id} className="relative aspect-square overflow-hidden rounded-xl bg-blush/40">
                  <Image src={img.url} alt={localized(img, "alt", currentLocale) || name} fill sizes="25vw" className="object-cover" unoptimized={!img.url.startsWith("/")} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            {product.categories && <Badge variant="secondary" className="rounded-full">{localized(product.categories, "name", currentLocale)}</Badge>}
            {product.is_featured && <Badge className="rounded-full bg-accent text-accent-foreground">{tc("featured")}</Badge>}
          </div>
          <h1 className="text-4xl">{name}</h1>
          {description && <p className="mt-4 whitespace-pre-line leading-relaxed text-foreground/85">{description}</p>}
          <div className="mt-8">
            <AddToCartForm
              product={{
                id: product.id,
                slug: product.slug,
                category_id: product.category_id,
                name_he: product.name_he,
                name_en: product.name_en,
                pricing_type: product.pricing_type,
                base_price_agorot: product.base_price_agorot,
                min_quantity: product.min_quantity,
                max_quantity: product.max_quantity,
                is_available: product.is_available,
                allow_notes: product.allow_notes,
                imageUrl: product.product_images[0]?.url ?? null,
              }}
              variants={product.product_variants.map((v) => ({
                id: v.id,
                product_id: v.product_id,
                kind: v.kind,
                label_he: v.label_he,
                label_en: v.label_en,
                min_quantity: v.min_quantity,
                price_agorot: v.price_agorot,
                is_active: v.is_active,
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
