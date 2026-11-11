"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, assertOwner } from "@/lib/auth/admin";
import { logAudit } from "@/lib/audit/log";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { errorMessage, fail, ok, type ActionResult } from "./action-result";
import { uploadImage } from "./storage";

const text = (max: number) => z.string().trim().max(max).default("");

const schema = z.object({
  business_name: z.string().trim().min(1, "נא להזין שם עסק").max(120),
  tagline: text(160),
  whatsapp_phone: text(30),
  business_email: z.union([z.literal(""), z.string().trim().email("אימייל לא תקין")]).default(""),
  pickup_address_he: text(300),
  pickup_address_en: text(300),
  opening_hours_he: text(1000),
  opening_hours_en: text(1000),
  delivery_info_he: text(1000),
  delivery_info_en: text(1000),
  announcement_he: text(300),
  announcement_en: text(300),
  announcement_active: z.coerce.boolean().default(false),
  instagram: z.union([z.literal(""), z.string().trim().url("קישור לא תקין")]).default(""),
  facebook: z.union([z.literal(""), z.string().trim().url("קישור לא תקין")]).default(""),
  tiktok: z.union([z.literal(""), z.string().trim().url("קישור לא תקין")]).default(""),
});

export async function saveSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = schema.safeParse({ ...raw, announcement_active: raw.announcement_active === "on" });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "קלט לא תקין");
    const d = parsed.data;
    let whatsapp: string | null = null;
    if (d.whatsapp_phone) {
      whatsapp = normalizePhone(d.whatsapp_phone);
      if (!whatsapp) return fail("מספר WhatsApp לא תקין");
    }
    const values = {
      business_name: d.business_name,
      tagline: d.tagline || "CAKES AND BOUTIQUE CONDITORIA",
      whatsapp_phone: whatsapp,
      business_email: d.business_email || null,
      pickup_address_he: d.pickup_address_he || null,
      pickup_address_en: d.pickup_address_en || null,
      opening_hours_he: d.opening_hours_he || null,
      opening_hours_en: d.opening_hours_en || null,
      delivery_info_he: d.delivery_info_he || null,
      delivery_info_en: d.delivery_info_en || null,
      announcement_he: d.announcement_he || null,
      announcement_en: d.announcement_en || null,
      announcement_active: d.announcement_active,
      social_links: { instagram: d.instagram || undefined, facebook: d.facebook || undefined, tiktok: d.tiktok || undefined },
    };
    const supabase = await createClient();
    const { error } = await supabase.from("business_settings").update(values).eq("id", 1);
    if (error) return fail(error.message);
    await logAudit("settings.update", "business_settings", "1", null, values);
    revalidatePath("/[locale]", "layout");
    return ok("ההגדרות נשמרו");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Only the owner may replace the logo. */
export async function uploadLogo(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertOwner();
    const file = formData.get("logo") as File | null;
    if (!file || file.size === 0) return fail("לא נבחר קובץ");
    const { url } = await uploadImage("site-media", "branding", file);
    const supabase = await createClient();
    const { error } = await supabase.from("business_settings").update({ logo_url: url }).eq("id", 1);
    if (error) return fail(error.message);
    await logAudit("settings.logo", "business_settings", "1", null, { logo_url: url });
    revalidatePath("/[locale]", "layout");
    return ok("הלוגו עודכן");
  } catch (e) {
    return fail(e instanceof Error && e.message === "forbidden" ? "רק בעלת העסק יכולה להחליף את הלוגו" : errorMessage(e));
  }
}

export async function resetLogo(): Promise<ActionResult> {
  try {
    await assertOwner();
    const supabase = await createClient();
    const { error } = await supabase.from("business_settings").update({ logo_url: null }).eq("id", 1);
    if (error) return fail(error.message);
    revalidatePath("/[locale]", "layout");
    return ok("חזרה ללוגו המקורי");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
