import Image from "next/image";
import { MapPin, MessageCircle, Truck } from "lucide-react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/branding/logo";
import { ProductCard } from "@/components/site/product-card";
import { Button } from "@/components/ui/button";
import { resolveLogoUrl } from "@/lib/data/logo";
import {
  getBusinessSettings,
  getCategories,
  getDeliveryCities,
  getGallery,
  getHomepageContent,
  getProducts,
  localized,
} from "@/lib/data/site";
import { formatMoney } from "@/lib/pricing/money";
import { buildWhatsAppLink } from "@/lib/whatsapp/message";
import { formatPhoneForDisplay } from "@/lib/whatsapp/phone";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const currentLocale = await getLocale();
  const [settings, content, categories, featured, gallery, cities] = await Promise.all([
    getBusinessSettings(),
    getHomepageContent(),
    getCategories(),
    getProducts({ featuredOnly: true }),
    getGallery(),
    getDeliveryCities(),
  ]);
  const logoUrl = resolveLogoUrl(settings);
  const name = settings?.business_name ?? "Nomi Nebentzhal";
  const tagline = settings?.tagline ?? "CAKES AND BOUTIQUE CONDITORIA";
  const heroTitle = content ? localized(content, "hero_title", currentLocale) : "";
  const heroSubtitle = content ? localized(content, "hero_subtitle", currentLocale) : "";
  const aboutTitle = (content && localized(content, "about_title", currentLocale)) || t("aboutTitle");
  const about = content ? localized(content, "about", currentLocale) : "";
  const pickupAddress = settings ? localized(settings, "pickup_address", currentLocale) : "";
  const deliveryInfo = settings ? localized(settings, "delivery_info", currentLocale) : "";
  const hours = settings ? localized(settings, "opening_hours", currentLocale) : "";

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-cream via-background to-background">
        {content?.hero_image_url && (
          <div className="absolute inset-0">
            <Image src={content.hero_image_url} alt="" fill priority className="object-cover opacity-30" sizes="100vw" unoptimized={!content.hero_image_url.startsWith("/")} />
          </div>
        )}
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center sm:py-24">
          <div className="animate-in fade-in zoom-in-95 duration-700">
            {logoUrl ? (
              <Logo src={logoUrl} businessName={name} tagline={tagline} height={180} priority className="[&>span]:w-[260px] sm:[&>span]:w-[360px] [&>span]:h-[180px] sm:[&>span]:h-[220px]" />
            ) : (
              <h1 className="font-display text-5xl sm:text-6xl" dir="ltr">
                {name}
              </h1>
            )}
          </div>
          {heroTitle && logoUrl && <h1 className="sr-only">{heroTitle}</h1>}
          {heroSubtitle && <p className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">{heroSubtitle}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-full px-8 shadow-lg shadow-rose/30">
              <Link href="/products">{t("heroCta")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full bg-white/70 px-8">
              <Link href="/products">{t("heroSecondary")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="mb-6 text-center text-3xl">{t("categoriesTitle")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${c.slug}`}
                className="card-elegant flex flex-col items-center gap-2 p-4 text-center"
              >
                <span className="relative size-16 overflow-hidden rounded-full bg-blush">
                  {c.image_url && <Image src={c.image_url} alt="" fill className="object-cover" sizes="64px" unoptimized={!c.image_url.startsWith("/")} />}
                </span>
                <span className="text-sm font-medium">{localized(c, "name", currentLocale)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-center text-3xl">{t("featuredTitle")}</h2>
        {featured.length === 0 ? (
          <p className="rounded-2xl bg-blush/40 p-8 text-center text-muted-foreground">{t("noProducts")}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.slice(0, 6).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* Gallery */}
      <section className="bg-cream py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-6 text-center text-3xl">{t("galleryTitle")}</h2>
          {gallery.length === 0 ? (
            <p className="text-center text-muted-foreground">{t("noGallery")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {gallery.map((g) => (
                <div key={g.id} className="relative aspect-square overflow-hidden rounded-2xl">
                  <Image src={g.url} alt={localized(g, "alt", currentLocale)} fill className="object-cover transition-transform duration-500 hover:scale-105" sizes="(max-width: 640px) 50vw, 25vw" unoptimized={!g.url.startsWith("/")} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2">
        <div>
          <h2 className="mb-4 text-3xl">{aboutTitle}</h2>
          {about ? <p className="whitespace-pre-line leading-relaxed text-foreground/85">{about}</p> : <p className="text-muted-foreground">…</p>}
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-blush/50">
          {content?.about_image_url && <Image src={content.about_image_url} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" unoptimized={!content.about_image_url.startsWith("/")} />}
        </div>
      </section>

      {/* Delivery & contact */}
      <section id="contact" className="bg-cream py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-2">
          <div className="card-elegant p-6">
            <h2 className="mb-4 text-2xl">{t("deliveryTitle")}</h2>
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                <div>
                  <p className="font-medium">{t("pickupLabel")}</p>
                  {pickupAddress && <p className="text-muted-foreground">{pickupAddress}</p>}
                  {hours && <p className="whitespace-pre-line text-muted-foreground">{hours}</p>}
                </div>
              </div>
              <div className="flex gap-3">
                <Truck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                <div>
                  <p className="font-medium">{t("deliveryLabel")}</p>
                  {deliveryInfo && <p className="whitespace-pre-line text-muted-foreground">{deliveryInfo}</p>}
                  {cities.length > 0 && (
                    <p className="mt-1 text-muted-foreground">
                      {t("deliveryCitiesNote")}{" "}
                      {cities.map((c) => `${localized(c, "name", currentLocale)} (${formatMoney(c.fee_agorot, currentLocale)})`).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="card-elegant flex flex-col items-start justify-center gap-4 p-6">
            <h2 className="text-2xl">{t("contactTitle")}</h2>
            {settings?.whatsapp_phone ? (
              <Button asChild size="lg" className="rounded-full bg-[#25D366] text-white hover:bg-[#1fb857]">
                <a href={buildWhatsAppLink(settings.whatsapp_phone, "")} target="_blank" rel="noopener">
                  <MessageCircle className="size-5" aria-hidden />
                  {t("whatsappCta")}
                  <span dir="ltr" className="font-normal opacity-90">{formatPhoneForDisplay(settings.whatsapp_phone)}</span>
                </a>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
            {settings?.business_email && (
              <a className="text-sm hover:text-accent" href={`mailto:${settings.business_email}`} dir="ltr">
                {settings.business_email}
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
