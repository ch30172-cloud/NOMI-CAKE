"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/admin";
import { logAudit } from "@/lib/audit/log";
import { ilsToAgorot } from "@/lib/pricing/money";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, fail, ok, type ActionResult } from "./action-result";

const schema = z.object({
  id: z.string().uuid().optional(),
  name_he: z.string().trim().min(1, "נא להזין שם עיר").max(100),
  name_en: z.string().trim().max(100).default(""),
  fee_ils: z.coerce.number().min(0, "מחיר משלוח לא תקין").max(10000),
  is_active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export async function saveDeliveryCity(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = schema.safeParse({ ...raw, is_active: raw.is_active === "on" || raw.is_active === "true" });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "קלט לא תקין");
    const d = parsed.data;
    const values = { name_he: d.name_he, name_en: d.name_en || null, fee_agorot: ilsToAgorot(d.fee_ils), is_active: d.is_active, sort_order: d.sort_order };
    const supabase = await createClient();
    if (d.id) {
      const { error } = await supabase.from("delivery_cities").update(values).eq("id", d.id);
      if (error) return fail(error.message);
      await logAudit("delivery_city.update", "delivery_cities", d.id, null, values);
    } else {
      const { data, error } = await supabase.from("delivery_cities").insert(values).select("id").single();
      if (error) return fail(error.message);
      await logAudit("delivery_city.create", "delivery_cities", data.id, null, values);
    }
    revalidatePath("/[locale]", "layout");
    return ok("נשמר");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function toggleDeliveryCity(id: string, is_active: boolean): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("delivery_cities").update({ is_active }).eq("id", id);
    if (error) return fail(error.message);
    revalidatePath("/[locale]", "layout");
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Soft delete: past orders keep their delivery_city_name snapshot. */
export async function deleteDeliveryCity(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("delivery_cities").update({ deleted_at: new Date().toISOString(), is_active: false }).eq("id", id);
    if (error) return fail(error.message);
    await logAudit("delivery_city.delete", "delivery_cities", id, null, null);
    revalidatePath("/[locale]", "layout");
    return ok("העיר הוסרה");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
