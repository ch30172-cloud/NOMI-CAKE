import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/pricing/money";

const MAX_ATTEMPTS = 6;

function backoffMinutes(attempt: number): number {
  return Math.min(2 ** attempt, 240); // 2, 4, 8, ... max 4h
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/**
 * Outbox worker. Picks pending email notifications and sends them through Resend.
 * Safe to run concurrently: a row is claimed by bumping attempts + next_attempt_at
 * before sending, so two workers never send the same email twice.
 * Returns counts for logging. If RESEND_API_KEY is missing, rows stay pending.
 */
export async function sendPendingNotifications(limit = 10): Promise<{ sent: number; failed: number; skipped: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const admin = createAdminClient();

  const { data: settings } = await admin.from("business_settings").select("business_name, business_email").eq("id", 1).maybeSingle();
  const to = settings?.business_email;
  if (!apiKey || !from || !to) return { sent: 0, failed: 0, skipped: limit };

  const { data: pending } = await admin
    .from("notifications")
    .select("*")
    .eq("channel", "email")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at")
    .limit(limit);
  if (!pending?.length) return { sent: 0, failed: 0, skipped: 0 };

  const resend = new Resend(apiKey);
  let sent = 0;
  let failed = 0;

  for (const n of pending) {
    // Claim the row (optimistic lock on attempts).
    const { data: claimed } = await admin
      .from("notifications")
      .update({ attempts: n.attempts + 1, next_attempt_at: new Date(Date.now() + backoffMinutes(n.attempts + 1) * 60_000).toISOString() })
      .eq("id", n.id)
      .eq("attempts", n.attempts)
      .select("id")
      .maybeSingle();
    if (!claimed) continue; // someone else took it

    try {
      const { subject, html, text } = await buildEmail(n.type, n.order_id, settings?.business_name ?? "Nomi Nebentzhal");
      const { error } = await resend.emails.send({ from, to, subject, html, text, headers: { "X-Entity-Ref-ID": n.id } });
      if (error) throw new Error(error.message);
      await admin.from("notifications").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", n.id);
      sent += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const exhausted = n.attempts + 1 >= MAX_ATTEMPTS;
      await admin.from("notifications").update({ status: exhausted ? "failed" : "pending", last_error: message }).eq("id", n.id);
      failed += 1;
    }
  }
  return { sent, failed, skipped: 0 };
}

async function buildEmail(type: string, orderId: string | null, businessName: string): Promise<{ subject: string; html: string; text: string }> {
  const admin = createAdminClient();
  if (type === "order_created" && orderId) {
    const { data: order } = await admin.from("orders").select("*, order_items(*)").eq("id", orderId).single();
    if (!order) throw new Error("order not found");
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const adminUrl = `${siteUrl}/he/admin/orders/${order.id}`;
    const items = order.order_items
      .map((i) => `• ${i.product_name_he}${i.variant_label_he ? ` (${i.variant_label_he})` : ""} × ${i.quantity} – ${i.line_total_agorot === null ? "מחיר בתיאום" : formatMoney(i.line_total_agorot, "he")}`)
      .join("\n");
    const text = [
      `הזמנה חדשה #${order.order_number}`,
      `שם: ${order.customer_name}`,
      `טלפון: ${order.customer_phone}`,
      order.customer_email ? `אימייל: ${order.customer_email}` : null,
      `אופן קבלה: ${order.fulfillment === "pickup" ? "איסוף עצמי" : `משלוח – ${order.delivery_address ?? ""}, ${order.delivery_city_name ?? ""}`}`,
      `תאריך: ${order.scheduled_date} ${order.scheduled_time.slice(0, 5)}`,
      "",
      items,
      "",
      `סה״כ${order.has_custom_pricing ? " (חלקי)" : ""}: ${formatMoney(order.total_agorot, "he")}`,
      order.notes ? `הערות: ${order.notes}` : null,
      "",
      `לצפייה במערכת הניהול: ${adminUrl}`,
    ]
      .filter((l) => l !== null)
      .join("\n");
    const html = `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6;color:#49343c"><h2 style="color:#b76e86">${escapeHtml(businessName)} – הזמנה חדשה #${order.order_number}</h2><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(text)}</pre></div>`;
    return { subject: `הזמנה חדשה #${order.order_number} – ${order.customer_name}`, html, text };
  }
  throw new Error(`unknown notification type ${type}`);
}
