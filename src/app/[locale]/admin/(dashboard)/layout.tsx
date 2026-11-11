import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Logo } from "@/components/branding/logo";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-nav";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { requireAdmin } from "@/lib/auth/admin";
import { resolveLogoUrl } from "@/lib/data/logo";
import { getBusinessSettings } from "@/lib/data/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };
// Admin data must never be cached or prerendered.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await requireAdmin();
  const supabase = await createClient();
  const [settings, { count }] = await Promise.all([
    getBusinessSettings(),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const pendingCount = count ?? 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-4">
        <div className="flex items-center gap-2">
          <AdminMobileNav pendingCount={pendingCount} />
          <Logo src={resolveLogoUrl(settings)} businessName={settings?.business_name} tagline={settings?.tagline} height={40} />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LanguageSwitcher />
          <span className="hidden sm:inline" dir="ltr">
            {admin.email}
          </span>
        </div>
      </header>
      <div className="flex flex-1">
        <AdminSidebar pendingCount={pendingCount} />
        <main className="min-w-0 flex-1 bg-background p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
