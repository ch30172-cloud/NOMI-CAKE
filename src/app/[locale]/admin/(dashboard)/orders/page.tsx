import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { PaymentBadge, STATUS_HE, StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/admin";
import { addDays, dateKeyInTz } from "@/lib/availability/slots";
import { formatMoney } from "@/lib/pricing/money";
import { createClient } from "@/lib/supabase/server";
import { formatPhoneForDisplay, normalizePhone } from "@/lib/whatsapp/phone";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

const STATUSES = Object.keys(STATUS_HE) as OrderStatus[];

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string; when?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 30;
  const supabase = await createClient();

  let q = supabase.from("orders").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (sp.status && STATUSES.includes(sp.status as OrderStatus)) q = q.eq("status", sp.status as OrderStatus);
  const today = dateKeyInTz(new Date());
  if (sp.when === "today") q = q.eq("scheduled_date", today);
  if (sp.when === "week") q = q.gte("scheduled_date", today).lte("scheduled_date", addDays(today, 6));
  if (sp.q) {
    const term = sp.q.trim();
    const phone = normalizePhone(term);
    const num = Number(term);
    const parts = [`customer_name.ilike.%${term.replace(/[%,()]/g, " ")}%`];
    if (phone) parts.push(`customer_phone.eq.${phone}`);
    else parts.push(`customer_phone.ilike.%${term.replace(/\D/g, "")}%`);
    if (Number.isInteger(num) && num > 0) parts.push(`order_number.eq.${num}`);
    q = q.or(parts.join(","));
  }
  const { data: orders, count } = await q;
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (overrides: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: sp.status, q: sp.q, when: sp.when, ...overrides })) if (v) u.set(k, v);
    const s = u.toString();
    return `/admin/orders${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageHeader title="הזמנות" description={`${total} הזמנות`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={href({ status: undefined, page: undefined })} className={cn("rounded-full px-3 py-1 text-sm ring-1 ring-border", !sp.status ? "bg-accent text-accent-foreground" : "bg-white")}>
          הכל
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={href({ status: s, page: undefined })} className={cn("rounded-full px-3 py-1 text-sm ring-1 ring-border", sp.status === s ? "bg-accent text-accent-foreground" : "bg-white")}>
            {STATUS_HE[s]}
          </Link>
        ))}
        <span className="mx-2 h-5 w-px bg-border" />
        <Link href={href({ when: sp.when === "today" ? undefined : "today", page: undefined })} className={cn("rounded-full px-3 py-1 text-sm ring-1 ring-border", sp.when === "today" ? "bg-accent text-accent-foreground" : "bg-white")}>
          להיום
        </Link>
        <Link href={href({ when: sp.when === "week" ? undefined : "week", page: undefined })} className={cn("rounded-full px-3 py-1 text-sm ring-1 ring-border", sp.when === "week" ? "bg-accent text-accent-foreground" : "bg-white")}>
          השבוע
        </Link>
        <form className="ms-auto flex gap-2">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="חיפוש: שם, טלפון או מספר הזמנה" className="w-64 bg-white" />
          <Button type="submit" variant="secondary">
            חיפוש
          </Button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>לקוח</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>מועד</TableHead>
              <TableHead>קבלה</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>תשלום</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orders ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  אין הזמנות תואמות.
                </TableCell>
              </TableRow>
            )}
            {(orders ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link href={`/admin/orders/${o.id}`} className="font-medium text-accent hover:underline">
                    #{o.order_number}
                  </Link>
                </TableCell>
                <TableCell>{o.customer_name}</TableCell>
                <TableCell dir="ltr" className="text-end">
                  {formatPhoneForDisplay(o.customer_phone)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {o.scheduled_date} {o.scheduled_time.slice(0, 5)}
                </TableCell>
                <TableCell className="text-sm">{o.fulfillment === "pickup" ? "איסוף" : `משלוח · ${o.delivery_city_name ?? ""}`}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatMoney(o.total_agorot, "he")}
                  {o.has_custom_pricing && <span className="ms-1 text-xs text-amber-700">(חלקי)</span>}
                </TableCell>
                <TableCell>
                  <StatusBadge status={o.status} />
                </TableCell>
                <TableCell>
                  <PaymentBadge status={o.payment_status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={href({ page: String(page - 1) })} className="rounded-full bg-white px-3 py-1 ring-1 ring-border">
              הקודם
            </Link>
          )}
          <span>
            עמוד {page} מתוך {pages}
          </span>
          {page < pages && (
            <Link href={href({ page: String(page + 1) })} className="rounded-full bg-white px-3 py-1 ring-1 ring-border">
              הבא
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
