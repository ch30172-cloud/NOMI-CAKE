import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { isTranslationConfigured } from "@/lib/translate";

export default async function NewProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("id, name_he").is("deleted_at", null).order("sort_order");
  return (
    <div>
      <PageHeader title="מוצר חדש" description="לאחר השמירה ניתן להעלות תמונות." />
      <ProductForm categories={categories ?? []} translationEnabled={isTranslationConfigured()} />
    </div>
  );
}
