"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/admin";
import { logAudit } from "@/lib/audit/log";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, fail, ok, type ActionResult } from "./action-result";
import { slugify } from "./slug";
import { uploadImage } from "./storage";

const schema = z.object({
  id: z.string().uuid().optional(),
  name_he: z.string().trim().min(1, "נא להזין שם בעברית").max(100),
  name_en: z.string().trim().max(100).default(""),
  description_he: z.string().trim().max(1000).default(""),
  description_en: z.string().trim().max(1000).default(""),
  slug: z.string().trim().max(100).default(""),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.coerce.boolean().default(true),
});

function revalidate() {
  revalidatePath("/[locale]", "layout");
}

export async function saveCategory(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = schema.safeParse({ ...raw, is_active: raw.is_active === "on" || raw.is_active === "true" });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "קלט לא תקין");
    const d = parsed.data;
    const supabase = await createClient();
    const file = formData.get("image") as File | null;
    let image_url: string | undefined;
    if (file && file.size > 0) image_url = (await uploadImage("site-media", "categories", file)).url;

    const values = {
      name_he: d.name_he,
      name_en: d.name_en || null,
      description_he: d.description_he || null,
      description_en: d.description_en || null,
      sort_order: d.sort_order,
      is_active: d.is_active,
      ...(image_url ? { image_url } : {}),
    };

    if (d.id) {
      const { data: before } = await supabase.from("categories").select("*").eq("id", d.id).single();
      const { error } = await supabase.from("categories").update(values).eq("id", d.id);
      if (error) return fail(error.message);
      await logAudit("category.update", "categories", d.id, before, values);
      revalidate();
      return ok("הקטגוריה עודכנה", d.id);
    }
    const slug = slugify(d.slug || d.name_en || d.name_he);
    const { data, error } = await supabase.from("categories").insert({ ...values, slug }).select("id").single();
    if (error) return fail(error.code === "23505" ? "כבר קיימת קטגוריה עם slug זהה" : error.message);
    await logAudit("category.create", "categories", data.id, null, { ...values, slug });
    revalidate();
    return ok("הקטגוריה נוצרה", data.id);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function toggleCategory(id: string, is_active: boolean): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("categories").update({ is_active }).eq("id", id);
    if (error) return fail(error.message);
    await logAudit("category.toggle", "categories", id, null, { is_active });
    revalidate();
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Safe delete: soft-deletes the category and detaches its products (they stay in the catalog without a category). */
export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error: pErr } = await supabase.from("products").update({ category_id: null }).eq("category_id", id);
    if (pErr) return fail(pErr.message);
    const { error } = await supabase.from("categories").update({ deleted_at: new Date().toISOString(), is_active: false }).eq("id", id);
    if (error) return fail(error.message);
    await logAudit("category.delete", "categories", id, null, null);
    revalidate();
    return ok("הקטגוריה נמחקה");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function reorderCategories(ids: string[]): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    for (const [i, id] of ids.entries()) {
      const { error } = await supabase.from("categories").update({ sort_order: i + 1 }).eq("id", id);
      if (error) return fail(error.message);
    }
    revalidate();
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}
