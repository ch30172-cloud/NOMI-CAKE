"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function MfaPanel({ mode }: { mode: "challenge" | "enroll" }) {
  const t = useTranslations("admin.mfa");
  const locale = useLocale();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      if (mode === "challenge") {
        const { data } = await supabase.auth.mfa.listFactors();
        const f = data?.totp.find((x) => x.status === "verified");
        setFactorId(f?.id ?? null);
      } else {
        // Remove stale unverified enrollments before starting a new one.
        const { data } = await supabase.auth.mfa.listFactors();
        for (const f of data?.all ?? []) if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
        const { data: enroll, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Admin" });
        if (error || !enroll) {
          setError(error?.message ?? "enroll failed");
          return;
        }
        setFactorId(enroll.id);
        setQr(enroll.totp.qr_code);
        setSecret(enroll.totp.secret);
      }
    })();
  }, [mode]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr || !challenge) {
      setError(t("invalid"));
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() });
    if (error) {
      setError(t("invalid"));
      setBusy(false);
      return;
    }
    window.location.assign(`/${locale}/admin`);
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      {mode === "enroll" && (
        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">{t("enrollHint")}</p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="TOTP QR" className="mx-auto size-44 rounded-lg bg-white p-2 ring-1 ring-rose/20" />
          )}
          {secret && (
            <p className="break-all rounded bg-muted p-2 font-mono text-xs" dir="ltr">
              {secret}
            </p>
          )}
        </div>
      )}
      <div>
        <Label htmlFor="code">{t("code")}</Label>
        <Input id="code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" pattern="[0-9]{6}" required value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 bg-white text-center tracking-[0.4em]" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full rounded-full" disabled={busy || !factorId}>
        {t("verify")}
      </Button>
      {mode === "enroll" && (
        <a href={`/${locale}/admin`} className="block text-center text-xs text-muted-foreground underline">
          {t("skipForNow")}
        </a>
      )}
    </form>
  );
}
