import { setRequestLocale } from "next-intl/server";
import { AvailabilityManager } from "@/components/admin/availability-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth/admin";
import { dateKeyInTz } from "@/lib/availability/slots";
import { createClient } from "@/lib/supabase/server";

export default async function AvailabilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const supabase = await createClient();
  const today = dateKeyInTz(new Date());
  const [{ data: rules }, { data: hours }, { data: blockedDates }, { data: blockedSlots }, { data: limits }, { data: usage }] = await Promise.all([
    supabase.from("availability_rules").select("*").eq("id", 1).single(),
    supabase.from("business_hours").select("*"),
    supabase.from("blocked_dates").select("*").gte("date", today).order("date"),
    supabase.from("blocked_time_slots").select("*").gte("date", today).order("date").order("start_time"),
    supabase.from("daily_order_limits").select("*").gte("date", today).order("date"),
    supabase.from("orders").select("scheduled_date, status, created_at").gte("scheduled_date", today).neq("status", "cancelled"),
  ]);
  if (!rules) return null;

  // Capacity usage per day (same policy as capacity_used() in SQL).
  const holdMs = rules.pending_hold_hours * 3600_000;
  const used: Record<string, number> = {};
  for (const o of usage ?? []) {
    const counts = o.status !== "pending" || Date.now() - new Date(o.created_at).getTime() < holdMs;
    if (counts) used[o.scheduled_date] = (used[o.scheduled_date] ?? 0) + 1;
  }

  return (
    <div>
      <PageHeader title="זמינות ויומן הזמנות" description="ימי פעילות, שעות איסוף ומשלוח, חסימות ומכסות יומיות. אזור זמן: Asia/Jerusalem." />
      <AvailabilityManager rules={rules} hours={hours ?? []} blockedDates={blockedDates ?? []} blockedSlots={blockedSlots ?? []} limits={limits ?? []} used={used} today={today} />
    </div>
  );
}
