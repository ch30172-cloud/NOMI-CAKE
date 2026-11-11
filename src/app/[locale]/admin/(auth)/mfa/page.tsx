import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MfaPanel } from "@/components/admin/mfa-panel";
import { getAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Two-factor authentication (TOTP via Supabase Auth MFA).
 * - If the admin has a verified factor and the session is still AAL1: challenge.
 * - Otherwise: enroll a new factor (reachable from Settings as well).
 */
export default async function MfaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await getAdmin();
  if (!admin) redirect(`/${locale}/admin/login`);
  const t = await getTranslations("admin.mfa");
  const mode = admin.hasMfaFactor && !admin.mfaVerified ? "challenge" : "enroll";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-cream to-background px-4 py-10">
      <div className="card-elegant w-full max-w-sm space-y-6 p-8">
        <h1 className="text-center text-2xl">{mode === "challenge" ? t("title") : t("enrollTitle")}</h1>
        <MfaPanel mode={mode} />
      </div>
    </div>
  );
}
