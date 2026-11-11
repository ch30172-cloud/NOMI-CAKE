import { Camera, Globe, Mail, MessageCircle } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/branding/logo";
import { formatPhoneForDisplay } from "@/lib/whatsapp/phone";
import { buildWhatsAppLink } from "@/lib/whatsapp/message";
import type { BusinessSettingsRow } from "@/types/database";

export async function SiteFooter({ settings, logoUrl }: { settings: BusinessSettingsRow | null; logoUrl: string | null }) {
  const t = await getTranslations("footer");
  const locale = await getLocale();
  const social = (settings?.social_links ?? {}) as Record<string, string | undefined>;
  const name = settings?.business_name ?? "Nomi Nebentzhal";
  const tagline = settings?.tagline ?? "CAKES AND BOUTIQUE CONDITORIA";
  const address = locale === "en" ? settings?.pickup_address_en || settings?.pickup_address_he : settings?.pickup_address_he;
  const hours = locale === "en" ? settings?.opening_hours_en || settings?.opening_hours_he : settings?.opening_hours_he;

  return (
    <footer className="mt-16 border-t border-rose/20 bg-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3">
        <div className="flex flex-col items-start gap-3">
          <Logo src={logoUrl} businessName={name} tagline={tagline} height={80} />
          {logoUrl && (
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground" dir="ltr">
              {tagline}
            </p>
          )}
        </div>
        <div className="space-y-2 text-sm">
          {address && <p>{address}</p>}
          {hours && <p className="whitespace-pre-line text-muted-foreground">{hours}</p>}
          {settings?.whatsapp_phone && (
            <a className="flex items-center gap-2 hover:text-accent" href={buildWhatsAppLink(settings.whatsapp_phone, "")} target="_blank" rel="noopener">
              <MessageCircle className="size-4" aria-hidden />
              <span dir="ltr">{formatPhoneForDisplay(settings.whatsapp_phone)}</span>
            </a>
          )}
          {settings?.business_email && (
            <a className="flex items-center gap-2 hover:text-accent" href={`mailto:${settings.business_email}`}>
              <Mail className="size-4" aria-hidden />
              <span dir="ltr">{settings.business_email}</span>
            </a>
          )}
        </div>
        <div className="space-y-3 text-sm">
          {(social.instagram || social.facebook) && (
            <div>
              <p className="mb-2 font-medium">{t("followUs")}</p>
              <div className="flex gap-3">
                {social.instagram && (
                  <a href={social.instagram} target="_blank" rel="noopener" aria-label="Instagram" className="rounded-full bg-white p-2 ring-1 ring-rose/20 hover:text-accent">
                    <Camera className="size-4" />
                  </a>
                )}
                {social.facebook && (
                  <a href={social.facebook} target="_blank" rel="noopener" aria-label="Facebook" className="rounded-full bg-white p-2 ring-1 ring-rose/20 hover:text-accent">
                    <Globe className="size-4" />
                  </a>
                )}
              </div>
            </div>
          )}
          <Link href="/privacy" className="block text-muted-foreground hover:text-accent">
            {t("privacy")}
          </Link>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {name}. {t("rights")}.
          </p>
        </div>
      </div>
    </footer>
  );
}
