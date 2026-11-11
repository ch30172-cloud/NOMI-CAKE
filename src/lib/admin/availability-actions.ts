"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/admin";
import { logAudit } from "@/lib/audit/log";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, fail, ok, type ActionResult } from "./action-result";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

function done(msg?: string) {
  revalidatePath("/[locale]", "layout");
  return ok(msg);
}

const rulesSchema = z.object({
  min_lead_days: z.coerce.number().int().min(0).max(60),
  max_days_ahead: z.coerce.number().int().min(1).max(365),
  slot_minutes: z.coerce.number().refine((v) => [15, 30, 60, 120].includes(v), "מרווח לא נתמך"),
  default_daily_limit: z.coerce.number().int().min(0).max(1000),
  pending_hold_hours: z.coerce.number().int().min(1).max(720),
});

export async function saveAvailabilityRules(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const parsed = rulesSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "קלט לא תקין");
    const supabase = await createClient();
    const { error } = await supabase.from("availability_rules").update(parsed.data).eq("id", 1);
    if (error) return fail(error.message);
    await logAudit("availability.rules", "availability_rules", "1", null, parsed.data);
    return done("ההגדרות נשמרו");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Saves all 14 rows (7 days × pickup/delivery) in one go. */
export async function saveBusinessHours(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const rows: { day_of_week: number; kind: "pickup" | "delivery"; open_time: string; close_time: string; is_active: boolean }[] = [];
    for (const kind of ["pickup", "delivery"] as const) {
      for (let d = 0; d < 7; d++) {
        const open = String(formData.get(`${kind}_${d}_open`) ?? "");
        const close = String(formData.get(`${kind}_${d}_close`) ?? "");
        const active = formData.get(`${kind}_${d}_active`) === "on";
        if (active && (!TIME.test(open) || !TIME.test(close) || open >= close)) return fail(`שעות לא תקינות ביום ${d + 1} (${kind === "pickup" ? "איסוף" : "משלוח"})`);
        rows.push({ day_of_week: d, kind, open_time: TIME.test(open) ? open : "10:00", close_time: TIME.test(close) ? close : "18:00", is_active: active });
      }
    }
    const { error } = await supabase.from("business_hours").upsert(rows, { onConflict: "day_of_week,kind" });
    if (error) return fail(error.message);
    await logAudit("availability.hours", "business_hours", null, null, rows);
    return done("שעות הפעילות נשמרו");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function addBlockedDate(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const from = String(formData.get("from") ?? "");
    const to = String(formData.get("to") ?? from);
    const reason = String(formData.get("reason") ?? "").trim() || null;
    if (!DATE.test(from) || !DATE.test(to) || to < from) return fail("טווח תאריכים לא תקין");
    const dates: string[] = [];
    const cur = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    while (cur <= end && dates.length < 366) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    const supabase = await createClient();
    const { error } = await supabase.from("blocked_dates").upsert(dates.map((date) => ({ date, reason })), { onConflict: "date" });
    if (error) return fail(error.message);
    await logAudit("availability.block_dates", "blocked_dates", null, null, { from, to, reason });
    return done(dates.length === 1 ? "התאריך נחסם" : `${dates.length} תאריכים נחסמו`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function removeBlockedDate(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
    if (error) return fail(error.message);
    return done();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function addBlockedSlot(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const date = String(formData.get("date") ?? "");
    const start = String(formData.get("start_time") ?? "");
    const end = String(formData.get("end_time") ?? "");
    const kindRaw = String(formData.get("kind") ?? "");
    const kind = kindRaw === "pickup" || kindRaw === "delivery" ? kindRaw : null;
    const reason = String(formData.get("reason") ?? "").trim() || null;
    if (!DATE.test(date) || !TIME.test(start) || !TIME.test(end) || start >= end) return fail("תאריך או שעות לא תקינים");
    const supabase = await createClient();
    const { error } = await supabase.from("blocked_time_slots").insert({ date, start_time: start, end_time: end, kind, reason });
    if (error) return fail(error.message);
    return done("השעות נחסמו");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function removeBlockedSlot(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("blocked_time_slots").delete().eq("id", id);
    if (error) return fail(error.message);
    return done();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function setDailyLimit(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const date = String(formData.get("date") ?? "");
    const max = Number(formData.get("max_orders"));
    if (!DATE.test(date) || !Number.isInteger(max) || max < 0) return fail("קלט לא תקין");
    const supabase = await createClient();
    const { error } = await supabase.from("daily_order_limits").upsert({ date, max_orders: max }, { onConflict: "date" });
    if (error) return fail(error.message);
    await logAudit("availability.daily_limit", "daily_order_limits", date, null, { max_orders: max });
    return done("המכסה עודכנה");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function removeDailyLimit(date: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("daily_order_limits").delete().eq("date", date);
    if (error) return fail(error.message);
    return done();
  } catch (e) {
    return fail(errorMessage(e));
  }
}
