import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardCharts } from "@/components/admin/dashboard-charts";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/admin";
import { formatMoney } from "@/lib/pricing/money";
import { createClient } from "@/lib/supabase/server";

interface Stats {
  new_orders: number;
  orders_today: number;
  orders_week: number;
  ordered_today_agorot: number;
  ordered_month_agorot: number;
  received_month_agorot: number;
  pickup_count: number;
  delivery_count: number;
  coupon_discount_month_agorot: number;
  top_products: { name: string; qty: number }[];
  monthly_sales: { month: string; ordered_agorot: number; orders: number }[];
  monthly_received: { month: string; received_agorot: number }[];
  busy_days: { date: string; used: number; limit: number }[];
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_stats");
  const stats = (data ?? null) as Stats | null;

  const tiles = stats
    ? [
        { label: "הזמנות חדשות (ממתינות)", value: stats.new_orders, href: "/admin/orders?status=pending" },
        { label: "הזמנות להיום", value: stats.orders_today, href: "/admin/orders?when=today" },
        { label: "הזמנות לשבוע הקרוב", value: stats.orders_week, href: "/admin/orders?when=week" },
        { label: "סכום הזמנות היום", value: formatMoney(stats.ordered_today_agorot, locale) },
        { label: "סכום הזמנות החודש", value: formatMoney(stats.ordered_month_agorot, locale), hint: "סכום ההזמנות שנרשמו, לא בהכרח שולמו" },
        { label: "תשלומים שהתקבלו החודש", value: formatMoney(stats.received_month_agorot, locale), hint: "הכנסות בפועל לפי רישומי תשלום" },
        { label: "הנחות וקופונים החודש", value: formatMoney(stats.coupon_discount_month_agorot, locale) },
        { label: "איסוף / משלוח (90 יום)", value: `${stats.pickup_count} / ${stats.delivery_count}` },
      ]
    : [];

  return (
    <div>
      <PageHeader title="לוח בקרה" description="הנתונים מחושבים מהזמנות ותשלומים אמיתיים במערכת." />
      {error && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">שגיאה בטעינת הנתונים: {error.message}</p>}
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tiles.map((t) => {
              const inner = (
                <Card className="h-full">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-normal text-muted-foreground">{t.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{t.value}</p>
                    {t.hint && <p className="mt-1 text-[11px] text-muted-foreground">{t.hint}</p>}
                  </CardContent>
                </Card>
              );
              return t.href ? (
                <Link key={t.label} href={t.href} className="block transition-transform hover:-translate-y-0.5">
                  {inner}
                </Link>
              ) : (
                <div key={t.label}>{inner}</div>
              );
            })}
          </div>

          {stats.busy_days.length > 0 && (
            <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
              <p className="mb-1 font-medium">ימים עמוסים בשבועיים הקרובים</p>
              <ul className="flex flex-wrap gap-3">
                {stats.busy_days.map((d) => (
                  <li key={d.date}>
                    {d.date}: {d.used}/{d.limit}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DashboardCharts monthlySales={stats.monthly_sales} monthlyReceived={stats.monthly_received} pickup={stats.pickup_count} delivery={stats.delivery_count} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">המוצרים הנמכרים ביותר (90 יום)</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.top_products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">אין עדיין נתונים.</p>
                ) : (
                  <ol className="space-y-2 text-sm">
                    {stats.top_products.map((p, i) => (
                      <li key={p.name} className="flex justify-between">
                        <span>
                          {i + 1}. {p.name}
                        </span>
                        <span className="text-muted-foreground">{p.qty}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
