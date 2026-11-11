import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { displayPriceAgorot, localized, type ProductWithRelations } from "@/lib/data/site";
import { formatMoney } from "@/lib/pricing/money";

export async function ProductCard({ product }: { product: ProductWithRelations }) {
  const locale = await getLocale();
  const t = await getTranslations("catalog");
  const image = product.product_images[0];
  const price = displayPriceAgorot(product);
  const name = localized(product, "name", locale);
  const description = localized(product, "description", locale);

  return (
    <Link href={`/products/${product.slug}`} className="card-elegant group block overflow-hidden">
      <div className="relative aspect-[4/3] w-full bg-blush/40">
        {image ? (
          <Image
            src={image.url}
            alt={localized(image, "alt", locale) || name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            unoptimized={!image.url.startsWith("/")}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl" aria-hidden>
            🎂
          </div>
        )}
        <div className="absolute start-3 top-3 flex gap-2">
          {product.is_featured && <Badge className="rounded-full bg-accent text-accent-foreground">{t("featured")}</Badge>}
          {!product.is_available && <Badge variant="secondary" className="rounded-full">{t("unavailable")}</Badge>}
        </div>
      </div>
      <div className="space-y-1.5 p-4">
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
      </div>
    </Link>
  );
}
