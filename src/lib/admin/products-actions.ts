"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/admin";
import { logAudit } from "@/lib/audit/log";
import { ilsToAgorot } from "@/lib/pricing/money";
import { createClient } from "@/lib/supabase/server";
import { isTranslationConfigured, translateText } from "@/lib/translate";
import { errorMessage, fail, ok, type ActionResult } from "./action-result";
import { slugify } from "./slug";
import { removeImage, uploadImage } from "./storage";

const variantSchema = z.object({
  id: z.string().uuid().optional(),
  label_he: z.string().trim().min(1, "נא להזין שם לגודל/מדרגה"),
  label_en: z.string().trim().default(""),
  min_quantity: z.coerce.number().int().min(1).optional(),
  price_ils: z.coerce.number().min(0),
  is_active: z.boolean().default(true),
});

const productSchema = z
  .object({
    id: z.string().uuid().optional(),
    category_id: z.string().uuid().nullable(),
    name_he: z.string().trim().min(1, "נא להזין שם מוצר בעברית").max(150),
    name_en: z.string().trim().max(150).default(""),
    description_he: z.string().trim().max(3000).default(""),
    description_en: z.string().trim().max(3000).default(""),
    en_approved: z.boolean().default(false),
    slug: z.string().trim().max(150).default(""),
    pricing_type: z.enum(["fixed", "by_size", "by_quantity", "custom"]),
    base_price_ils: z.coerce.number().min(0).nullable(),
    min_quantity: z.coerce.number().int().min(1).default(1),
    max_quantity: z.coerce.number().int().min(1).nullable(),
    is_featured: z.boolean().default(false),
    is_available: z.boolean().default(true),
    allow_notes: z.boolean().default(true),
    sort_order: z.coerce.number().int().min(0).default(0),
    variants: z.array(variantSchema).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.pricing_type === "fixed" && v.base_price_ils === null) ctx.addIssue({ code: "custom", path: ["base_price_ils"], message: "נא להזין מחיר" });
    if (v.pricing_type === "by_size" && v.variants.filter((x) => x.is_active).length === 0) ctx.addIssue({ code: "custom", path: ["variants"], message: "נא להגדיר לפחות גודל אחד" });
    if (v.pricing_type === "by_quantity") {
      if (v.variants.length === 0 && v.base_price_ils === null) ctx.addIssue({ code: "custom", path: ["variants"], message: "נא להגדיר מחיר ליחידה או מדרגות כמות" });
      if (v.variants.some((x) => !x.min_quantity)) ctx.addIssue({ code: "custom", path: ["variants"], message: "לכל מדרגה נדרשת כמות מינימלית" });
    }
    if (v.max_quantity !== null && v.max_quantity < v.min_quantity) ctx.addIssue({ code: "custom", path: ["max_quantity"], message: "כמות מקסימלית קטנה מהמינימלית" });
  });

export type ProductFormInput = z.input<typeof productSchema>;

function revalidate() {
  revalidatePath("/[locale]", "layout");
}

export async function saveProduct(input: ProductFormInput): Promise<ActionResult> {
  try {
    await assertAdmin();
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(issue?.message ?? "קלט לא תקין", issue ? { [issue.path.join(".")]: issue.message } : undefined);
    }
    const d = parsed.data;
    const supabase = await createClient();
    const values = {
      category_id: d.category_id,
      name_he: d.name_he,
      name_en: d.name_en || null,
      description_he: d.description_he || null,
      description_en: d.description_en || null,
      en_translation_status: d.name_en ? (d.en_approved ? ("approved" as const) : ("suggested" as const)) : ("none" as const),
      pricing_type: d.pricing_type,
      base_price_agorot: d.pricing_type === "custom" || d.pricing_type === "by_size" ? null : d.base_price_ils !== null ? ilsToAgorot(d.base_price_ils) : null,
      min_quantity: d.min_quantity,
      max_quantity: d.max_quantity,
      is_featured: d.is_featured,
      is_available: d.is_available,
      allow_notes: d.allow_notes,
      sort_order: d.sort_order,
    };

    let productId = d.id;
    if (productId) {
      const { data: before } = await supabase.from("products").select("*").eq("id", productId).single();
      const { error } = await supabase.from("products").update(values).eq("id", productId);
      if (error) return fail(error.message);
      await logAudit("product.update", "products", productId, before, values);
    } else {
      const slug = slugify(d.slug || d.name_en || d.name_he);
      const { data, error } = await supabase.from("products").insert({ ...values, slug }).select("id").single();
      if (error) return fail(error.code === "23505" ? "כבר קיים מוצר עם slug זהה" : error.message);
      productId = data.id;
      await logAudit("product.create", "products", productId, null, { ...values, slug });
    }

    // Variants: upsert given ones, deactivate the rest (keeps order_items.variant_id valid).
    const kind = d.pricing_type === "by_size" ? "size" : "quantity_tier";
    const keepIds: string[] = [];
    if (d.pricing_type === "by_size" || d.pricing_type === "by_quantity") {
      for (const [i, v] of d.variants.entries()) {
        const row = {
          product_id: productId,
          kind: kind as "size" | "quantity_tier",
          label_he: v.label_he,
          label_en: v.label_en || null,
          min_quantity: kind === "quantity_tier" ? (v.min_quantity ?? 1) : null,
          price_agorot: ilsToAgorot(v.price_ils),
          sort_order: i + 1,
          is_active: v.is_active,
        };
        if (v.id) {
          const { error } = await supabase.from("product_variants").update(row).eq("id", v.id).eq("product_id", productId);
          if (error) return fail(error.message);
          keepIds.push(v.id);
        } else {
          const { data, error } = await supabase.from("product_variants").insert(row).select("id").single();
          if (error) return fail(error.message);
          keepIds.push(data.id);
        }
      }
    }
    const { data: existing } = await supabase.from("product_variants").select("id").eq("product_id", productId);
    const toDeactivate = (existing ?? []).map((v) => v.id).filter((id) => !keepIds.includes(id));
    if (toDeactivate.length) await supabase.from("product_variants").update({ is_active: false }).in("id", toDeactivate);

    // Translation history
    if (d.name_en) {
      await supabase.from("product_translations").insert({ product_id: productId, locale: "en", name: d.name_en, description: d.description_en || null, source: "manual", approved: d.en_approved });
    }

    revalidate();
    return ok("המוצר נשמר", productId);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function uploadProductImage(productId: string, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const file = formData.get("image") as File | null;
    if (!file || file.size === 0) return fail("לא נבחר קובץ");
    const { url, path } = await uploadImage("product-images", productId, file);
    const supabase = await createClient();
    const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
    const { error } = await supabase.from("product_images").insert({ product_id: productId, url, storage_path: path, sort_order: (count ?? 0) + 1 });
    if (error) return fail(error.message);
    revalidate();
    return ok("התמונה הועלתה");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function deleteProductImage(imageId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { data: img } = await supabase.from("product_images").select("*").eq("id", imageId).single();
    if (!img) return fail("התמונה לא נמצאה");
    const { error } = await supabase.from("product_images").delete().eq("id", imageId);
    if (error) return fail(error.message);
    await removeImage("product-images", img.storage_path);
    revalidate();
    return ok("התמונה נמחקה");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function reorderProductImages(ids: string[]): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    for (const [i, id] of ids.entries()) await supabase.from("product_images").update({ sort_order: i + 1 }).eq("id", id);
    revalidate();
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function toggleProductFlag(id: string, field: "is_featured" | "is_available", value: boolean): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const patch = field === "is_featured" ? { is_featured: value } : { is_available: value };
    const { error } = await supabase.from("products").update(patch).eq("id", id);
    if (error) return fail(error.message);
    await logAudit("product.toggle", "products", id, null, { [field]: value });
    revalidate();
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Soft delete. Order history keeps its snapshot; the product disappears from the catalog. */
export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString(), is_available: false, is_featured: false }).eq("id", id);
    if (error) return fail(error.message);
    await logAudit("product.delete", "products", id, null, null);
    revalidate();
    const locale = await getLocale();
    redirect(`/${locale}/admin/products`);
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    return fail(errorMessage(e));
  }
}

export async function suggestTranslation(nameHe: string, descriptionHe: string): Promise<{ ok: true; name: string; description: string } | { ok: false; error: string }> {
  try {
    await assertAdmin();
    if (!isTranslationConfigured()) return { ok: false, error: "שירות התרגום עדיין לא הוגדר (TRANSLATE_PROVIDER / TRANSLATE_API_KEY)." };
    const [name, description] = await Promise.all([translateText(nameHe, "he", "en"), descriptionHe ? translateText(descriptionHe, "he", "en") : Promise.resolve("")]);
    return { ok: true, name: name ?? "", description: description ?? "" };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
