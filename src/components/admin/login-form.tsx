"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const t = useTranslations("admin.login");
  const locale = useLocale();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") === "not_admin" ? t("notAdmin") : null);
  const [busy, setBusy] = useState(false);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(t("invalid"));
      setBusy(false);
      return;
    }
    // Full navigation so the server reads the new cookies and checks admin_users.
    window.location.assign(`/${locale}/admin`);
  }

  async function signInWithGoogle() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback?next=/${locale}/admin` },
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={signInWithPassword} className="space-y-3">
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" type="email" dir="ltr" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-white" />
        </div>
        <div>
          <Label htmlFor="password">{t("password")}</Label>
          <Input id="password" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 bg-white" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full rounded-full" disabled={busy}>
          {t("submit")}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> {t("or")} <span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" className="w-full rounded-full bg-white" disabled={busy} onClick={signInWithGoogle}>
        {t("google")}
      </Button>
    </div>
  );
}
