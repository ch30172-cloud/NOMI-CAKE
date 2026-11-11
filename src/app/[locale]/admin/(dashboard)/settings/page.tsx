import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/branding/logo";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { LogoUploader } from "@/components/admin/logo-uploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/admin";
import { resolveLogoUrl } from "@/lib/data/logo";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("business_settings").select("*").eq("id", 1).single();
  if (!settings) return null;
  const logoUrl = resolveLogoUrl(settings);

  return (
    <div className="space-y-6">
      <PageHeader title="הגדרות העסק" description="פרטי קשר, מספר WhatsApp לקבלת הזמנות, כתובת איסוף, שעות פעילות ורשתות חברתיות." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <SettingsForm settings={settings} />
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">לוגו</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-center rounded-lg bg-cream p-4">
                <Logo src={logoUrl} businessName={settings.business_name} tagline={settings.tagline} height={100} />
              </div>
              {admin.role === "owner" ? <LogoUploader hasCustomLogo={Boolean(settings.logo_url)} /> : <p className="text-xs text-muted-foreground">רק בעלת העסק יכולה להחליף את הלוגו.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">אבטחה</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                אימות דו-שלבי: {admin.hasMfaFactor ? <span className="text-emerald-700">מופעל</span> : <span className="text-amber-700">לא מופעל</span>}
              </p>
              <Link href="/admin/mfa" className="text-accent underline">
                {admin.hasMfaFactor ? "הוספת מכשיר אימות נוסף" : "הפעלת אימות דו-שלבי"}
              </Link>
              <p className="text-xs text-muted-foreground" dir="ltr">
                {admin.email} · {admin.role}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
