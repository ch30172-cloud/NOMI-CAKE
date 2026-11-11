"use client";

import { BarChart3, CalendarDays, ExternalLink, LayoutGrid, LogOut, Package, Settings, Tag, Ticket, Truck, FileText, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/lib/admin/auth-actions";

const ITEMS = [
  { href: "/admin", key: "dashboard", icon: BarChart3 },
  { href: "/admin/orders", key: "orders", icon: Package },
  { href: "/admin/products", key: "products", icon: LayoutGrid },
  { href: "/admin/categories", key: "categories", icon: Tag },
  { href: "/admin/coupons", key: "coupons", icon: Ticket },
  { href: "/admin/delivery", key: "delivery", icon: Truck },
  { href: "/admin/availability", key: "availability", icon: CalendarDays },
  { href: "/admin/content", key: "content", icon: FileText },
  { href: "/admin/settings", key: "settings", icon: Settings },
] as const;

function NavLinks({ onNavigate, pendingCount }: { onNavigate?: () => void; pendingCount: number }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="admin">
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-sidebar-accent font-medium text-sidebar-primary" : "hover:bg-sidebar-accent/60")}
          >
            <Icon className="size-4" aria-hidden />
            <span className="flex-1">{t(key)}</span>
            {key === "orders" && pendingCount > 0 && <span className="rounded-full bg-accent px-2 text-xs text-accent-foreground">{pendingCount}</span>}
          </Link>
        );
      })}
      <Link href="/" target="_blank" className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60">
        <ExternalLink className="size-4" aria-hidden /> {t("viewSite")}
      </Link>
      <form action={signOutAction}>
        <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60">
          <LogOut className="size-4" aria-hidden /> {t("logout")}
        </button>
      </form>
    </nav>
  );
}

export function AdminSidebar({ pendingCount }: { pendingCount: number }) {
  return (
    <aside className="hidden w-60 shrink-0 border-e border-sidebar-border bg-sidebar p-4 lg:block">
      <NavLinks pendingCount={pendingCount} />
    </aside>
  );
}

export function AdminMobileNav({ pendingCount }: { pendingCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-64 bg-sidebar p-4">
        <SheetTitle className="sr-only">menu</SheetTitle>
        <div className="mt-6">
          <NavLinks onNavigate={() => setOpen(false)} pendingCount={pendingCount} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
