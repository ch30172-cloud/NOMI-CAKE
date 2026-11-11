import type { Metadata } from "next";
import { Search } from "lucide-react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ProductCard } from "@/components/site/product-card";
import { Input } from "@/components/ui/input";
import { getCategories, getProducts, localized } from "@/lib/data/site";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("title") };
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { category, q } = await searchParams;
  const t = await getTranslations("catalog");
  const currentLocale = await getLocale();
  const [categories, products] = await Promise.all([getCategories(), getProducts({ categorySlug: category, search: q })]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-center text-4xl">{t("title")}</h1>

      <form className="mx-auto mb-6 flex max-w-md items-center gap-2" role="search">
        {category && <input type="hidden" name="category" value={category} />}
        <label htmlFor="q" className="sr-only">
          {t("searchLabel")}
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder={t("search")} className="rounded-full bg-white ps-9" />
        </div>
      </form>

      <nav className="mb-8 flex flex-wrap justify-center gap-2" aria-label={t("title")}>
        <Link
          href={q ? `/products?q=${encodeURIComponent(q)}` : "/products"}
          className={cn("rounded-full px-4 py-1.5 text-sm ring-1 ring-rose/30 transition-colors", !category ? "bg-accent text-accent-foreground" : "bg-white hover:bg-secondary")}
        >
          {t("all")}
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/products?category=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn("rounded-full px-4 py-1.5 text-sm ring-1 ring-rose/30 transition-colors", category === c.slug ? "bg-accent text-accent-foreground" : "bg-white hover:bg-secondary")}
          >
            {localized(c, "name", currentLocale)}
          </Link>
        ))}
      </nav>

      <p className="mb-4 text-center text-sm text-muted-foreground">{t("results", { count: products.length })}</p>

      {products.length === 0 ? (
        <p className="rounded-2xl bg-blush/40 p-10 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
