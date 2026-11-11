import "server-only";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AdminUserRow } from "@/types/database";

export interface AdminContext {
  userId: string;
  email: string;
  role: AdminUserRow["role"];
  mfaVerified: boolean;
  hasMfaFactor: boolean;
}

/**
 * Returns the signed-in admin or null. Authorization is enforced by the
 * admin_users table (and by RLS for every query) – never by the UI alone.
 */
export async function getAdmin(): Promise<AdminContext | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: admin } = await supabase.from("admin_users").select("*").eq("user_id", user.id).eq("is_active", true).maybeSingle();
  if (!admin) return null;
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasMfaFactor = (factors?.totp ?? []).some((f) => f.status === "verified");
  return {
    userId: user.id,
    email: admin.email,
    role: admin.role,
    mfaVerified: aal?.currentLevel === "aal2",
    hasMfaFactor,
  };
}

/** For admin pages/actions: redirects to login (or MFA challenge) when not authorized. */
export async function requireAdmin(): Promise<AdminContext> {
  const locale = await getLocale();
  const admin = await getAdmin();
  if (!admin) redirect(`/${locale}/admin/login`);
  if (admin.hasMfaFactor && !admin.mfaVerified) redirect(`/${locale}/admin/mfa`);
  return admin;
}

/** For server actions: throws instead of redirecting. */
export async function assertAdmin(): Promise<AdminContext> {
  const admin = await getAdmin();
  if (!admin) throw new Error("forbidden");
  if (admin.hasMfaFactor && !admin.mfaVerified) throw new Error("mfa_required");
  return admin;
}

export async function assertOwner(): Promise<AdminContext> {
  const admin = await assertAdmin();
  if (admin.role !== "owner") throw new Error("forbidden");
  return admin;
}
