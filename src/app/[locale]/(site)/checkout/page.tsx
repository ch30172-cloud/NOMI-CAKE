import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getBusinessSettings, getDeliveryCities, localized } from "@/lib/data/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("title"), robots: { index: false } };
}

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("checkout");
  const currentLocale = await getLocale();
  const [cities, settings] = await Promise.all([getDeliveryCities(), getBusinessSettings()]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-8 text-center text-4xl">{t("title")}</h1>
      <CheckoutForm
        cities={cities.map((c) => ({ id: c.id, name: localized(c, "name", currentLocale), feeAgorot: c.fee_agorot }))}
        pickupAddress={settings ? localized(settings, "pickup_address", currentLocale) : ""}
      />
    </div>
  );
}
