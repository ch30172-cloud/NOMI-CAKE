"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addBlockedDate,
  addBlockedSlot,
  removeBlockedDate,
  removeBlockedSlot,
  removeDailyLimit,
  saveAvailabilityRules,
  saveBusinessHours,
  setDailyLimit,
} from "@/lib/admin/availability-actions";
import type { AvailabilityRulesRow, BlockedDateRow, BlockedTimeSlotRow, BusinessHoursRow, DailyOrderLimitRow } from "@/types/database";

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function AvailabilityManager({
  rules,
  hours,
  blockedDates,
  blockedSlots,
  limits,
  used,
  today,
}: {
  rules: AvailabilityRulesRow;
  hours: BusinessHoursRow[];
  blockedDates: BlockedDateRow[];
  blockedSlots: BlockedTimeSlotRow[];
  limits: DailyOrderLimitRow[];
  used: Record<string, number>;
  today: string;
}) {
  const [, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "שגיאה");
    });
  const hour = (kind: "pickup" | "delivery", d: number) => hours.find((h) => h.kind === kind && h.day_of_week === d);

  return (
    <Tabs defaultValue="rules" className="space-y-4">
      <TabsList className="flex-wrap">
        <TabsTrigger value="rules">כללים ומכסה</TabsTrigger>
        <TabsTrigger value="hours">שעות פעילות</TabsTrigger>
        <TabsTrigger value="blocked">חסימות וחופשות</TabsTrigger>
        <TabsTrigger value="limits">מכסות יומיות</TabsTrigger>
      </TabsList>

      <TabsContent value="rules">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">כללי הזמנה</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveAvailabilityRules} className="grid gap-4 sm:grid-cols-2">
              {() => (
                <>
                  <div>
                    <Label htmlFor="min_lead_days">כמה ימים מראש יש להזמין</Label>
                    <Input id="min_lead_days" name="min_lead_days" type="number" min="0" dir="ltr" defaultValue={rules.min_lead_days} />
                  </div>
                  <div>
                    <Label htmlFor="max_days_ahead">עד כמה ימים קדימה ניתן להזמין</Label>
                    <Input id="max_days_ahead" name="max_days_ahead" type="number" min="1" dir="ltr" defaultValue={rules.max_days_ahead} />
                  </div>
                  <div>
                    <Label htmlFor="slot_minutes">מרווח בין שעות (דקות)</Label>
                    <select id="slot_minutes" name="slot_minutes" className="mt-1 h-9 w-full rounded-md border border-input bg-white px-2 text-sm" defaultValue={rules.slot_minutes}>
                      {[15, 30, 60, 120].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="default_daily_limit">מכסת הזמנות ברירת מחדל ליום</Label>
                    <Input id="default_daily_limit" name="default_daily_limit" type="number" min="0" dir="ltr" defaultValue={rules.default_daily_limit} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="pending_hold_hours">כמה שעות הזמנה ״ממתינה לאישור״ תופסת מקום במכסה</Label>
                    <Input id="pending_hold_hours" name="pending_hold_hours" type="number" min="1" dir="ltr" defaultValue={rules.pending_hold_hours} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      הזמנה שלא אושרה בתוך פרק הזמן הזה משחררת את המקום אוטומטית (היא לא נמחקת). הזמנות מאושרות תמיד נספרות. ראי docs/CAPACITY_POLICY.md.
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <SubmitButton>שמירה</SubmitButton>
                  </div>
                </>
              )}
            </ActionForm>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="hours">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">שעות איסוף ומשלוח לפי יום</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveBusinessHours} className="space-y-6">
              {() => (
                <>
                  {(["pickup", "delivery"] as const).map((kind) => (
                    <div key={kind}>
                      <h3 className="mb-2 font-medium">{kind === "pickup" ? "איסוף עצמי" : "משלוחים"}</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <tbody>
                            {DAYS.map((name, d) => {
                              const h = hour(kind, d);
                              return (
                                <tr key={d} className="border-b last:border-0">
                                  <td className="py-1.5 pe-3">
                                    <label className="flex items-center gap-2">
                                      <input type="checkbox" name={`${kind}_${d}_active`} defaultChecked={h?.is_active ?? false} /> {name}
                                    </label>
                                  </td>
                                  <td className="py-1.5 pe-2">
                                    <Input type="time" name={`${kind}_${d}_open`} dir="ltr" className="w-32" defaultValue={h?.open_time.slice(0, 5) ?? "10:00"} />
                                  </td>
                                  <td className="py-1.5">
                                    <Input type="time" name={`${kind}_${d}_close`} dir="ltr" className="w-32" defaultValue={h?.close_time.slice(0, 5) ?? "18:00"} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                  <SubmitButton>שמירת שעות</SubmitButton>
                </>
              )}
            </ActionForm>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="blocked" className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">תאריכים חסומים / חופשה</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ActionForm action={addBlockedDate} className="grid grid-cols-2 gap-2 sm:grid-cols-4" resetOnSuccess>
              {() => (
                <>
                  <div>
                    <Label className="text-xs">מתאריך</Label>
                    <Input type="date" name="from" dir="ltr" min={today} required />
                  </div>
                  <div>
                    <Label className="text-xs">עד תאריך</Label>
                    <Input type="date" name="to" dir="ltr" min={today} />
                  </div>
                  <div>
                    <Label className="text-xs">סיבה</Label>
                    <Input name="reason" placeholder="חופשה" />
                  </div>
                  <div className="flex items-end">
                    <SubmitButton size="sm">חסימה</SubmitButton>
                  </div>
                </>
              )}
            </ActionForm>
            <ul className="divide-y text-sm">
              {blockedDates.length === 0 && <li className="py-2 text-muted-foreground">אין תאריכים חסומים.</li>}
              {blockedDates.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-1.5">
                  <span>
                    {b.date} {b.reason && <span className="text-muted-foreground">· {b.reason}</span>}
                  </span>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => run(() => removeBlockedDate(b.id))} aria-label="הסרה">
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">שעות חסומות</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ActionForm action={addBlockedSlot} className="grid grid-cols-2 gap-2 sm:grid-cols-5" resetOnSuccess>
              {() => (
                <>
                  <div>
                    <Label className="text-xs">תאריך</Label>
                    <Input type="date" name="date" dir="ltr" min={today} required />
                  </div>
                  <div>
                    <Label className="text-xs">משעה</Label>
                    <Input type="time" name="start_time" dir="ltr" required />
                  </div>
                  <div>
                    <Label className="text-xs">עד שעה</Label>
                    <Input type="time" name="end_time" dir="ltr" required />
                  </div>
                  <div>
                    <Label className="text-xs">חל על</Label>
                    <select name="kind" className="mt-1 h-9 w-full rounded-md border border-input bg-white px-2 text-sm" defaultValue="">
                      <option value="">הכל</option>
                      <option value="pickup">איסוף</option>
                      <option value="delivery">משלוח</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <SubmitButton size="sm">חסימה</SubmitButton>
                  </div>
                </>
              )}
            </ActionForm>
            <ul className="divide-y text-sm">
              {blockedSlots.length === 0 && <li className="py-2 text-muted-foreground">אין שעות חסומות.</li>}
              {blockedSlots.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-1.5">
                  <span>
                    {b.date} {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)} <span className="text-muted-foreground">· {b.kind === "pickup" ? "איסוף" : b.kind === "delivery" ? "משלוח" : "הכל"}</span>
                  </span>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => run(() => removeBlockedSlot(b.id))} aria-label="הסרה">
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="limits">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">מכסה שונה ליום מסוים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">ברירת המחדל היא {rules.default_daily_limit} הזמנות ליום. כאן אפשר לקבוע מכסה אחרת לתאריך ספציפי (0 = סגור להזמנות).</p>
            <ActionForm action={setDailyLimit} className="flex flex-wrap items-end gap-2" resetOnSuccess>
              {() => (
                <>
                  <div>
                    <Label className="text-xs">תאריך</Label>
                    <Input type="date" name="date" dir="ltr" min={today} required />
                  </div>
                  <div>
                    <Label className="text-xs">מכסה</Label>
                    <Input type="number" name="max_orders" min="0" dir="ltr" className="w-24" required />
                  </div>
                  <SubmitButton size="sm">שמירה</SubmitButton>
                </>
              )}
            </ActionForm>
            <ul className="divide-y text-sm">
              {limits.length === 0 && <li className="py-2 text-muted-foreground">אין מכסות מיוחדות.</li>}
              {limits.map((l) => (
                <li key={l.date} className="flex items-center justify-between py-1.5">
                  <span>
                    {l.date}: {used[l.date] ?? 0} / {l.max_orders}
                  </span>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => run(() => removeDailyLimit(l.date))} aria-label="הסרה">
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            {Object.keys(used).length > 0 && (
              <div>
                <h4 className="mb-1 text-sm font-medium">תפוסה קרובה</h4>
                <ul className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(used)
                    .sort()
                    .slice(0, 30)
                    .map(([d, n]) => (
                      <li key={d} className="rounded-full bg-muted px-2 py-0.5">
                        {d}: {n}/{limits.find((l) => l.date === d)?.max_orders ?? rules.default_daily_limit}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
