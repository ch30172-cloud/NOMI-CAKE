import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { displayPriceAgorot, localized, type ProductWithRelations } from "@/lib/data/site";
import { formatMoney } from "@/lib/pricing/money";
import { ImageCarousel } from "./image-carousel";

export async function ProductCard({ product }: { product: ProductWithRelations }) {
  const locale = await getLocale();
  const t = await getTranslations("catalog");
  const price = displayPriceAgorot(product);
  const name = localized(product, "name", locale);
  const description = localized(product, "description", locale);
  const href = `/products/${product.slug}`;
  const images = product.product_images.map((img) => ({ url: img.url, alt: localized(img, "alt", locale) || name }));

  // The card is a plain container: the photo strip can be swiped, and the text block is the
  // single keyboard-focusable link (no buttons nested inside a link).
  return (
    <div className="card-elegant group relative overflow-hidden">
      <div className="relative">
        <ImageCarousel images={images} variant="card" href={href} label={name} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
        <div className="pointer-events-none absolute start-3 top-3 z-10 flex gap-2">
          {product.is_featured && <Badge className="rounded-full bg-accent text-accent-foreground">{t("featured")}</Badge>}
          {!product.is_available && (
            <Badge variant="secondary" className="rounded-full">
              {t("unavailable")}
            </Badge>
          )}
        </div>
      </div>
      <Link href={href} className="block space-y-1.5 p-4">
        <h3 className="text-lg leading-snug">{name}</h3>
        {description && <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>}
        <p className="pt-1 text-base font-medium text-accent">
          {price.agorot === null ? (
            t("customPrice")
          ) : (
            <>
              {price.from && <span className="me-1 text-xs font-normal text-muted-foreground">{t("from")}</span>}
              {formatMoney(price.agorot, locale)}
              {product.pricing_type === "by_quantity" && <span className="ms-1 text-xs font-normal text-muted-foreground">{t("perUnit")}</span>}
            </>
          )}
        </p>
      </Link>
    </div>
  );
}
