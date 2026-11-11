import { getLocale } from "next-intl/server";
import { CartProvider } from "@/components/cart/cart-context";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { resolveLogoUrl } from "@/lib/data/logo";
import { getBusinessSettings } from "@/lib/data/site";

// Content is edited from the admin and must appear immediately: render on demand.
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getBusinessSettings();
  const locale = await getLocale();
  const logoUrl = resolveLogoUrl(settings);
  const announcement = locale === "en" ? settings?.announcement_en || settings?.announcement_he : settings?.announcement_he;

  return (
    <CartProvider>
      {settings?.announcement_active && announcement && (
        <div className="bg-accent px-4 py-2 text-center text-sm text-accent-foreground">{announcement}</div>
      )}
      <SiteHeader
        logoUrl={logoUrl}
        businessName={settings?.business_name ?? "Nomi Nebentzhal"}
        tagline={settings?.tagline ?? "CAKES AND BOUTIQUE CONDITORIA"}
      />
      <main className="flex-1">{children}</main>
      <SiteFooter settings={settings} logoUrl={logoUrl} />
    </CartProvider>
  );
}
