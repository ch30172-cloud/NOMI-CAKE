import type { Metadata } from "next";
import { Heebo, Playfair_Display } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { dirFor, routing } from "@/i18n/routing";
import { getBusinessSettings } from "@/lib/data/site";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "brand" });
  const settings = await getBusinessSettings();
  const name = settings?.business_name ?? t("name");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(siteUrl),
    title: { default: name, template: `%s | ${name}` },
    description: settings?.tagline ?? t("tagline"),
    alternates: {
      languages: { he: "/he", en: "/en", "x-default": "/he" },
    },
    openGraph: {
      siteName: name,
      type: "website",
      locale: locale === "he" ? "he_IL" : "en_US",
      images: [{ url: "/branding/logo-original.jpg" }],
    },
    icons: { icon: "/favicon.ico" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={dirFor(locale)} className={`${heebo.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col font-sans">
        <NextIntlClientProvider>
          {children}
          <Toaster position={locale === "he" ? "top-left" : "top-right"} richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
