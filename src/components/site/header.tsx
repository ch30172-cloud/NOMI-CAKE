"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/branding/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LanguageSwitcher } from "./language-switcher";
import { CartButton } from "./cart-button";

interface HeaderProps {
  logoUrl: string | null;
  businessName: string;
  tagline: string;
}

export function SiteHeader({ logoUrl, businessName, tagline }: HeaderProps) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/", label: t("home") },
    { href: "/products", label: t("catalog") },
    { href: "/#about", label: t("about") },
    { href: "/#contact", label: t("contact") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-rose/15 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-20">
        <Link href="/" className="flex items-center" aria-label={businessName}>
          <Logo src={logoUrl} businessName={businessName} tagline={tagline} height={52} priority />
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-foreground/80 transition-colors hover:text-accent">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <CartButton />
          <Button asChild size="sm" className="hidden rounded-full px-4 sm:inline-flex">
            <Link href="/products">{t("orderNow")}</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("openMenu")}>
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-72 bg-cream">
              <SheetTitle className="sr-only">{t("openMenu")}</SheetTitle>
              <div className="mt-8 flex flex-col gap-1 px-2">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-base hover:bg-secondary">
                    {l.label}
                  </Link>
                ))}
                <Button asChild className="mt-4 rounded-full">
                  <Link href="/products" onClick={() => setOpen(false)}>
                    {t("orderNow")}
                  </Link>
                </Button>
                <LanguageSwitcher className="mt-2 justify-start" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
