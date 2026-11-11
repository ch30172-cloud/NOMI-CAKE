import Image from "next/image";
import { Plus } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { ProductFlags } from "@/components/admin/product-flags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/admin";
import { displayPriceAgorot, type ProductWithRelations } from "@/lib/data/site";
import { formatMoney } from "@/lib/pricing/money";
import { createClient } from "@/lib/supabase/server";

const PRICING_LABEL: Record<string, string> = { fixed: "מחיר קבוע", by_size: "לפי גודל", by_quantity: "לפי כמות", custom: "בתיאום אישי" };

export default async function ProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, product_images(*), product_variants(*), categories(id, slug, name_he, name_en)")
    .is("deleted_at", null)
    .order("sort_order")
    .order("created_at", { ascending: false });
  const products = (data ?? []) as unknown as ProductWithRelations[];

  return (
    <div>
      <PageHeader
        title="מוצרים"
        description="כל שינוי כאן משתקף מיד באתר הלקוחות."
        actions={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="size-4" /> מוצר חדש
            </Link>
          </Button>
        }
      />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16" />
              <TableHead>מוצר</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>תמחור</TableHead>
              <TableHead>מחיר</TableHead>
              <TableHead>אנגלית</TableHead>
              <TableHead>מומלץ</TableHead>
              <TableHead>זמין</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  אין מוצרים עדיין. הוסיפי את המוצרים האמיתיים של העסק.
                </TableCell>
              </TableRow>
            )}
            {products.map((p) => {
              const img = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)[0];
              const price = displayPriceAgorot({ ...p, product_variants: p.product_variants.filter((v) => v.is_active) });
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="relative size-12 overflow-hidden rounded-lg bg-blush/40">
                      {img && <Image src={img.url} alt="" fill sizes="48px" className="object-cover" unoptimized />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/products/${p.id}`} className="font-medium hover:text-accent">
                      {p.name_he}
                    </Link>
                    {p.name_en && (
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {p.name_en}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{p.categories?.name_he ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm">{PRICING_LABEL[p.pricing_type]}</TableCell>
                  <TableCell className="text-sm">{price.agorot === null ? "—" : `${price.from ? "מ-" : ""}${formatMoney(price.agorot, "he")}`}</TableCell>
                  <TableCell>
                    {p.en_translation_status === "approved" && <Badge className="bg-emerald-100 text-emerald-800">מאושר</Badge>}
                    {p.en_translation_status === "suggested" && <Badge className="bg-amber-100 text-amber-800">ממתין לאישור</Badge>}
                    {p.en_translation_status === "none" && <Badge variant="secondary">אין</Badge>}
                  </TableCell>
                  <ProductFlags id={p.id} isFeatured={p.is_featured} isAvailable={p.is_available} />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
