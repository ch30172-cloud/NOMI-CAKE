import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Logo } from "@/components/branding/logo";
import { LoginForm } from "@/components/admin/login-form";
import { getAdmin } from "@/lib/auth/admin";
import { resolveLogoUrl } from "@/lib/data/logo";
import { getBusinessSettings } from "@/lib/data/site";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await getAdmin();
  if (admin) redirect(`/${locale}/admin`);
  const t = await getTranslations("admin.login");
  const settings = await getBusinessSettings();
  const logoUrl = resolveLogoUrl(settings);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-cream to-background px-4 py-10">
      <div className="card-elegant w-full max-w-sm space-y-6 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo src={logoUrl} businessName={settings?.business_name} tagline={settings?.tagline} height={110} priority />
          <h1 className="text-2xl">{t("title")}</h1>
        </div>
        {isSupabaseConfigured() ? <LoginForm /> : <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t("notConfigured")}</p>}
      </div>
    </div>
  );
}
