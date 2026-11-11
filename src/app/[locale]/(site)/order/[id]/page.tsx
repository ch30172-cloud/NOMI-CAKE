import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ClearCartOnMount } from "@/components/checkout/clear-cart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBusinessSettings } from "@/lib/data/site";
import { formatMoney } from "@/lib/pricing/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { buildOrderMessage, buildWhatsAppLink } from "@/lib/whatsapp/message";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { t: token } = await searchParams;
  const t = await getTranslations("orderConfirm");
  const ts = await getTranslations("status");
  const currentLocale = (await getLocale()) as "he" | "en";

  const uuid = /^[0-9a-f-]{36}$/i;
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY || !token || !uuid.test(id) || !uuid.test(token)) {
    return <NotFound message={t("notFound")} back={t("backHome")} />;
  }

  // The confirmation page is protected by the per-order public token (not guessable).
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("*, order_items(*)").eq("id", id).eq("public_token", token).maybeSingle();
  if (!order) return <NotFound message={t("notFound")} back={t("backHome")} />;
  const settings = await getBusinessSettings();

  const message = buildOrderMessage(
    {
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      items: order.order_items.map((i) => ({
        name: currentLocale === "en" && i.product_name_en ? i.product_name_en : i.product_name_he,
        variant: currentLocale === "en" && i.variant_label_en ? i.variant_label_en : i.variant_label_he,
        quantity: i.quantity,
        lineTotalAgorot: i.line_total_agorot,
        notes: i.notes,
      })),
      fulfillment: order.fulfillment,
      deliveryCityName: order.delivery_city_name,
      deliveryAddress: order.delivery_address,
      scheduledDate: order.scheduled_date,
      scheduledTime: order.scheduled_time.slice(0, 5),
      subtotalAgorot: order.subtotal_agorot,
      discountAgorot: order.discount_agorot,
      couponCode: order.coupon_code,
      deliveryFeeAgorot: order.delivery_fee_agorot,
      totalAgorot: order.total_agorot,
      hasCustomPricing: order.has_custom_pricing,
      notes: order.notes,
    },
    currentLocale
  );
  const waLink = settings?.whatsapp_phone ? buildWhatsAppLink(settings.whatsapp_phone, message) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <ClearCartOnMount />
      <div className="card-elegant space-y-6 p-8 text-center">
        <h1 className="text-4xl">{t("title")}</h1>
        <p className="text-lg">
          {t("orderNumber")}: <span className="font-semibold">#{order.order_number}</span>
        </p>
        <p>
          {t("status")}: <Badge variant="secondary" className="rounded-full">{ts(order.status)}</Badge>
        </p>
        {order.status === "pending" && <p className="rounded-xl bg-blush/50 p-4 text-sm">{t("pendingNotice")}</p>}
        {waLink ? (
          <Button asChild size="lg" className="rounded-full bg-[#25D366] px-8 text-white hover:bg-[#1fb857]">
            <a href={waLink} target="_blank" rel="noopener">
              <MessageCircle className="size-5" aria-hidden />
              {t("sendWhatsApp")}
            </a>
          </Button>
        ) : (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("whatsappMissing")}</p>
        )}
        <p className="text-xs text-muted-foreground">{t("resend")}</p>
        <pre dir={currentLocale === "he" ? "rtl" : "ltr"} className="whitespace-pre-wrap rounded-xl bg-cream p-4 text-start text-sm">
          {message}
        </pre>
        <p className="text-sm text-muted-foreground">{formatMoney(order.total_agorot, currentLocale)}</p>
        <Link href="/" className="inline-block text-sm text-accent underline">
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}

function NotFound({ message, back }: { message: string; back: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="mb-4 text-muted-foreground">{message}</p>
      <Link href="/" className="text-accent underline">
        {back}
      </Link>
    </div>
  );
}
