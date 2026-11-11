"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const next = locale === "he" ? "en" : "he";
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      aria-label={t("switchLanguage")}
      onClick={() => router.replace(pathname, { locale: next })}
    >
      <Languages className="size-4" aria-hidden />
      <span>{t("language")}</span>
    </Button>
  );
}
