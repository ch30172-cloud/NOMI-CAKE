import { setRequestLocale } from "next-intl/server";
import { CategoryManager } from "@/components/admin/category-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").is("deleted_at", null).order("sort_order");
  return (
    <div>
      <PageHeader title="קטגוריות" description="הוספה, עריכה, הסתרה, שינוי סדר ומחיקה בטוחה. מחיקה אינה מוחקת מוצרים." />
      <CategoryManager categories={data ?? []} />
    </div>
  );
}
