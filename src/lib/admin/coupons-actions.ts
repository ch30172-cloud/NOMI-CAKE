"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/admin";
import { logAudit } from "@/lib/audit/log";
import { ilsToAgorot } from "@/lib/pricing/money";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, fail, ok, type ActionResult } from "./action-result";

const schema = z
  .object({
    id: z.string().uuid().optional(),
    code: z.string().trim().min(2, "קוד קצר מדי").max(40).regex(/^[A-Za-z0-9_-]+$/, "קוד: אותיות לטיניות, ספרות, - או _ בלבד"),
    discount_type: z.enum(["percent", "fixed", "free_delivery"]),
    value: z.coerce.number().min(0).default(0),
    scope: z.enum(["order", "product", "category"]),
    product_id: z.string().uuid().nullable(),
    category_id: z.string().uuid().nullable(),
    min_order_ils: z.coerce.number().min(0).default(0),
    starts_at: z.string().default(""),
    expires_at: z.string().default(""),
    max_redemptions: z.coerce.number().int().min(0).nullable(),
    is_active: z.coerce.boolean().default(true),
    terms_he: z.string().trim().max(500).default(""),
    terms_en: z.string().trim().max(500).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.discount_type === "percent" && (v.value < 1 || v.value > 100)) ctx.addIssue({ code: "custom", path: ["value"], message: "אחוז הנחה בין 1 ל-100" });
    if (v.discount_type === "fixed" && v.value <= 0) ctx.addIssue({ code: "custom", path: ["value"], message: "נא להזין סכום הנחה" });
    if (v.scope === "product" && !v.product_id) ctx.addIssue({ code: "custom", path: ["product_id"], message: "נא לבחור מוצר" });
    if (v.scope === "category" && !v.category_id) ctx.addIssue({ code: "custom", path: ["category_id"], message: "נא לבחור קטגוריה" });
    if (v.starts_at && v.expires_at && v.starts_at > v.expires_at) ctx.addIssue({ code: "custom", path: ["expires_at"], message: "תאריך תפוגה לפני תאריך ההתחלה" });
  });

export async function saveCoupon(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
    const parsed = schema.safeParse({
      ...raw,
      product_id: raw.product_id || null,
      category_id: raw.category_id || null,
      max_redemptions: raw.max_redemptions === "" || raw.max_redemptions === undefined ? null : raw.max_redemptions,
      is_active: raw.is_active === "on" || raw.is_active === "true",
    });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "קלט לא תקין");
    const d = parsed.data;
    const values = {
      code: d.code.toUpperCase(),
      discount_type: d.discount_type,
      value: d.discount_type === "fixed" ? ilsToAgorot(d.value) : d.discount_type === "percent" ? Math.round(d.value) : 0,
      scope: d.scope,
      product_id: d.scope === "product" ? d.product_id : null,
      category_id: d.scope === "category" ? d.category_id : null,
      min_order_agorot: ilsToAgorot(d.min_order_ils),
      starts_at: d.starts_at ? new Date(d.starts_at).toISOString() : null,
      expires_at: d.expires_at ? new Date(`${d.expires_at}T23:59:59`).toISOString() : null,
      max_redemptions: d.max_redemptions,
      is_active: d.is_active,
      terms_he: d.terms_he || null,
      terms_en: d.terms_en || null,
    };
    const supabase = await createClient();
    if (d.id) {
      const { error } = await supabase.from("coupons").update(values).eq("id", d.id);
      if (error) return fail(error.code === "23505" ? "קוד קופון כבר קיים" : error.message);
      await logAudit("coupon.update", "coupons", d.id, null, values);
    } else {
      const { data, error } = await supabase.from("coupons").insert(values).select("id").single();
      if (error) return fail(error.code === "23505" ? "קוד קופון כבר קיים" : error.message);
      await logAudit("coupon.create", "coupons", data.id, null, values);
    }
    revalidatePath("/[locale]/admin/coupons", "page");
    return ok("הקופון נשמר");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function toggleCoupon(id: string, is_active: boolean): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("coupons").update({ is_active }).eq("id", id);
    if (error) return fail(error.message);
    revalidatePath("/[locale]/admin/coupons", "page");
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Soft delete: redemption history is kept for reporting. */
export async function deleteCoupon(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("coupons").update({ deleted_at: new Date().toISOString(), is_active: false }).eq("id", id);
    if (error) return fail(error.message);
    await logAudit("coupon.delete", "coupons", id, null, null);
    revalidatePath("/[locale]/admin/coupons", "page");
    return ok("הקופון נמחק");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
