import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { ProductImagesManager } from "@/components/admin/product-images-manager";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { isTranslationConfigured } from "@/lib/translate";

export default async function EditProductPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*, product_images(*), product_variants(*)").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("categories").select("id, name_he").is("deleted_at", null).order("sort_order"),
  ]);
  if (!product) notFound();
  const images = [...product.product_images].sort((a, b) => a.sort_order - b.sort_order);
  const variants = product.product_variants.filter((v) => v.is_active).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-8">
      <PageHeader title={`עריכת מוצר: ${product.name_he}`} />
      <ProductForm categories={categories ?? []} translationEnabled={isTranslationConfigured()} product={product} variants={variants} />
      <section>
        <h2 className="mb-3 text-xl font-medium">תמונות</h2>
        <ProductImagesManager productId={product.id} images={images} />
      </section>
    </div>
  );
}
