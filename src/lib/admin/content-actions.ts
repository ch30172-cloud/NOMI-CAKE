"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/admin";
import { logAudit } from "@/lib/audit/log";
import { createClient } from "@/lib/supabase/server";
import type { HomepageContentRow } from "@/types/database";
import { errorMessage, fail, ok, type ActionResult } from "./action-result";
import { removeImage, uploadImage } from "./storage";

const text = (max: number) => z.string().trim().max(max).default("");

const homepageSchema = z.object({
  hero_title_he: text(120),
  hero_title_en: text(120),
  hero_subtitle_he: text(300),
  hero_subtitle_en: text(300),
  about_title_he: text(120),
  about_title_en: text(120),
  about_he: text(5000),
  about_en: text(5000),
});

function done(msg: string) {
  revalidatePath("/[locale]", "layout");
  return ok(msg);
}

export async function saveHomepage(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const parsed = homepageSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "קלט לא תקין");
    const values: Partial<Pick<HomepageContentRow, keyof typeof parsed.data | "hero_image_url" | "about_image_url">> = {};
    for (const k of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) values[k] = parsed.data[k] || null;
    const hero = formData.get("hero_image") as File | null;
    const about = formData.get("about_image") as File | null;
    if (hero && hero.size > 0) values.hero_image_url = (await uploadImage("site-media", "homepage", hero)).url;
    if (about && about.size > 0) values.about_image_url = (await uploadImage("site-media", "homepage", about)).url;
    const supabase = await createClient();
    const { error } = await supabase.from("homepage_content").update(values).eq("id", 1);
    if (error) return fail(error.message);
    await logAudit("content.homepage", "homepage_content", "1", null, values);
    return done("תוכן דף הבית נשמר");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function addGalleryImages(formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return fail("לא נבחרו קבצים");
    const supabase = await createClient();
    const { count } = await supabase.from("gallery_images").select("id", { count: "exact", head: true });
    let order = count ?? 0;
    for (const file of files) {
      const { url, path } = await uploadImage("site-media", "gallery", file);
      order += 1;
      const { error } = await supabase.from("gallery_images").insert({ url, storage_path: path, sort_order: order });
      if (error) return fail(error.message);
    }
    return done(`${files.length} תמונות נוספו לגלריה`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function deleteGalleryImage(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { data: img } = await supabase.from("gallery_images").select("*").eq("id", id).single();
    if (!img) return fail("לא נמצא");
    const { error } = await supabase.from("gallery_images").delete().eq("id", id);
    if (error) return fail(error.message);
    await removeImage("site-media", img.storage_path);
    return done("התמונה הוסרה");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function toggleGalleryImage(id: string, is_active: boolean): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("gallery_images").update({ is_active }).eq("id", id);
    if (error) return fail(error.message);
    return done("עודכן");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function reorderGallery(ids: string[]): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    for (const [i, id] of ids.entries()) await supabase.from("gallery_images").update({ sort_order: i + 1 }).eq("id", id);
    return done("הסדר נשמר");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
