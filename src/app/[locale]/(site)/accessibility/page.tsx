import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getBusinessSettings } from "@/lib/data/site";
import { formatPhoneForDisplay } from "@/lib/whatsapp/phone";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "a11y" });
  return { title: t("statementTitle") };
}

export default async function AccessibilityStatementPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("a11y");
  const settings = await getBusinessSettings();
  const name = settings?.business_name ?? "Nomi Nebentzhal";
  const features = t.raw("features") as string[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 leading-relaxed">
      <h1 className="mb-6 text-4xl">{t("statementTitle")}</h1>
      <p className="mb-4">{t("intro", { name })}</p>

      <h2 className="mb-2 mt-8 text-2xl">{t("standardTitle")}</h2>
      <p className="mb-4">{t("standard")}</p>

      <h2 className="mb-2 mt-8 text-2xl">{t("featuresTitle")}</h2>
      <ul className="mb-4 list-disc space-y-1 ps-6">
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <h2 className="mb-2 mt-8 text-2xl">{t("limitsTitle")}</h2>
      <p className="mb-4">{t("limits")}</p>

      <h2 className="mb-2 mt-8 text-2xl">{t("contactTitle")}</h2>
      <p className="mb-2">{t("contact")}</p>
      <ul className="mb-4 space-y-1">
        <li>{name}</li>
        {settings?.whatsapp_phone && (
          <li>
            {t("phone")}: <span dir="ltr">{formatPhoneForDisplay(settings.whatsapp_phone)}</span>
          </li>
        )}
        {settings?.business_email && (
          <li>
            {t("email")}:{" "}
            <a className="underline" href={`mailto:${settings.business_email}`} dir="ltr">
              {settings.business_email}
            </a>
          </li>
        )}
      </ul>
      <p className="text-sm text-muted-foreground">{t("updated", { date: "2026-11-18" })}</p>
    </div>
  );
}
