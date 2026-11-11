import { defineRouting } from "next-intl/routing";

export const locales = ["he", "en"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "he",
  localePrefix: "always",
});

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function dirFor(locale: string): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}
