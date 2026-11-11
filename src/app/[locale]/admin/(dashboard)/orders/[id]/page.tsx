import { MessageCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { OrderStatusActions } from "@/components/admin/order-status-actions";
import { PageHeader } from "@/components/admin/page-header";
import { PaymentsPanel } from "@/components/admin/payments-panel";
import { PaymentBadge, STATUS_HE, StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/admin";
import { formatMoney } from "@/lib/pricing/money";
import { createClient } from "@/lib/supabase/server";
import { buildStatusMessage, buildWhatsAppLink } from "@/lib/whatsapp/message";
import { formatPhoneForDisplay } from "@/lib/whatsapp/phone";

export default async function OrderDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: order }, { data: history }, { data: payments }] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").eq("id", id).maybeSingle(),
    supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at"),
    supabase.from("payments").select("*").eq("order_id", id).order("paid_at").order("created_at"),
  ]);
  if (!order) notFound();

  const paid = (payments ?? []).filter((p) => p.kind === "payment").reduce((s, p) => s + p.amount_agorot, 0);
  const refunded = (payments ?? []).filter((p) => p.kind === "refund").reduce((s, p) => s + p.amount_agorot, 0);
  const balance = order.total_agorot - paid + refunded;
  const waCustomer = buildWhatsAppLink(order.customer_phone, buildStatusMessage(order.status, order.order_number, order.customer_name, order.locale));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`הזמנה #${order.order_number}`}
        description={`נוצרה ${new Date(order.created_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`}
        actions={
          <Button asChild className="bg-[#25D366] text-white hover:bg-[#1fb857]">
            <a href={waCustomer} target="_blank" rel="noopener">
              <MessageCircle className="size-4" /> WhatsApp ללקוח
            </a>
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={order.status} />
        <PaymentBadge status={order.payment_status} />
        {order.has_custom_pricing && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">כולל פריטים במחיר בתיאום אישי</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">פריטים</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {order.order_items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {i.product_name_he}
                      {i.variant_label_he && <span className="text-muted-foreground"> ({i.variant_label_he})</span>} × {i.quantity}
                    </p>
                    {i.notes && <p className="text-xs text-muted-foreground">הערה: {i.notes}</p>}
                  </div>
                  <span className="whitespace-nowrap">{i.line_total_agorot === null ? "בתיאום אישי" : formatMoney(i.line_total_agorot, "he")}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <dt>סכום ביניים</dt>
                <dd>{formatMoney(order.subtotal_agorot, "he")}</dd>
              </div>
              {order.discount_agorot > 0 && (
                <div className="flex justify-between text-accent">
                  <dt>הנחה {order.coupon_code && `(${order.coupon_code})`}</dt>
                  <dd>-{formatMoney(order.discount_agorot, "he")}</dd>
                </div>
              )}
              {order.fulfillment === "delivery" && (
                <div className="flex justify-between">
                  <dt>משלוח</dt>
                  <dd>{formatMoney(order.delivery_fee_agorot, "he")}</dd>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold">
                <dt>סה״כ{order.has_custom_pricing ? " (חלקי)" : ""}</dt>
                <dd>{formatMoney(order.total_agorot, "he")}</dd>
              </div>
            </dl>
            {order.notes && <p className="mt-3 rounded-lg bg-blush/40 p-3 text-sm">הערות הלקוח: {order.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">לקוח ומועד</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{order.customer_name}</p>
            <p dir="ltr" className="text-end">
              {formatPhoneForDisplay(order.customer_phone)}
            </p>
            {order.customer_email && (
              <p dir="ltr" className="text-end">
                {order.customer_email}
              </p>
            )}
            <p>
              {order.fulfillment === "pickup" ? "איסוף עצמי" : "משלוח"}
              {order.fulfillment === "delivery" && (
                <>
                  <br />
                  {order.delivery_address}, {order.delivery_city_name}
                </>
              )}
            </p>
            <p className="font-medium">
              {order.scheduled_date} בשעה {order.scheduled_time.slice(0, 5)}
            </p>
            <p className="text-xs text-muted-foreground">שפת ההזמנה: {order.locale === "he" ? "עברית" : "English"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">סטטוס</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <OrderStatusActions orderId={order.id} status={order.status} />
            <ol className="space-y-1 text-xs text-muted-foreground">
              {(history ?? []).map((h) => (
                <li key={h.id}>
                  {new Date(h.created_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}: {h.from_status ? `${STATUS_HE[h.from_status]} ← ` : ""}
                  {STATUS_HE[h.to_status]}
                  {h.note && ` · ${h.note}`}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <PaymentsPanel orderId={order.id} payments={payments ?? []} totalAgorot={order.total_agorot} paidAgorot={paid} refundedAgorot={refunded} balanceAgorot={balance} />
      </div>
    </div>
  );
}
