"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/admin";
import { logAudit } from "@/lib/audit/log";
import { ilsToAgorot } from "@/lib/pricing/money";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/database";
import { errorMessage, fail, ok, type ActionResult } from "./action-result";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_preparation", "ready", "completed", "cancelled"],
  in_preparation: ["ready", "completed", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: ["pending"], // re-open by mistake only
};

export async function updateOrderStatus(orderId: string, to: OrderStatus, note?: string): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const supabase = await createClient();
    const { data: order } = await supabase.from("orders").select("status").eq("id", orderId).single();
    if (!order) return fail("ההזמנה לא נמצאה");
    if (!ALLOWED_TRANSITIONS[order.status].includes(to)) return fail(`לא ניתן לעבור מ"${order.status}" ל"${to}"`);
    const { error } = await supabase.from("orders").update({ status: to }).eq("id", orderId);
    if (error) return fail(error.message);
    if (note) {
      await supabase.from("order_status_history").update({ note }).eq("order_id", orderId).eq("to_status", to).order("created_at", { ascending: false }).limit(1);
    }
    await logAudit("order.status", "orders", orderId, { status: order.status }, { status: to, by: admin.email });
    revalidatePath("/[locale]/admin", "layout");
    return ok("הסטטוס עודכן");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const paymentSchema = z.object({
  order_id: z.string().uuid(),
  kind: z.enum(["payment", "refund"]),
  amount_ils: z.coerce.number().positive("סכום חייב להיות גדול מאפס"),
  method: z.enum(["cash", "bit", "bank_transfer", "other"]),
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין"),
  is_deposit: z.coerce.boolean().default(false),
  note: z.string().trim().max(500).default(""),
});

export async function addPayment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = paymentSchema.safeParse({ ...raw, is_deposit: raw.is_deposit === "on" });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "קלט לא תקין");
    const d = parsed.data;
    const supabase = await createClient();
    const row = { order_id: d.order_id, kind: d.kind, amount_agorot: ilsToAgorot(d.amount_ils), method: d.method, paid_at: d.paid_at, is_deposit: d.is_deposit, note: d.note || null, created_by: admin.userId };
    const { error } = await supabase.from("payments").insert(row);
    if (error) return fail(error.message);
    await logAudit("payment.add", "orders", d.order_id, null, row);
    revalidatePath("/[locale]/admin", "layout");
    return ok(d.kind === "refund" ? "ההחזר נרשם" : "התשלום נרשם");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function deletePayment(paymentId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { data: p } = await supabase.from("payments").select("*").eq("id", paymentId).single();
    if (!p) return fail("לא נמצא");
    const { error } = await supabase.from("payments").delete().eq("id", paymentId);
    if (error) return fail(error.message);
    await logAudit("payment.delete", "orders", p.order_id, p, null);
    revalidatePath("/[locale]/admin", "layout");
    return ok("הרישום נמחק");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function markNotificationsRead(): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_read: true }).eq("channel", "admin").eq("is_read", false);
}
