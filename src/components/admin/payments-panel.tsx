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
import { addPayment, deletePayment } from "@/lib/admin/orders-actions";
import { formatMoney } from "@/lib/pricing/money";
import { dateKeyInTz } from "@/lib/availability/slots";
import type { PaymentRow } from "@/types/database";

const METHOD_HE = { cash: "מזומן", bit: "Bit", bank_transfer: "העברה בנקאית", other: "אחר" } as const;

export function PaymentsPanel({ orderId, payments, totalAgorot, paidAgorot, refundedAgorot, balanceAgorot }: { orderId: string; payments: PaymentRow[]; totalAgorot: number; paidAgorot: number; refundedAgorot: number; balanceAgorot: number }) {
  const [, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">תשלומים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">סכום הזמנה</dt>
            <dd className="font-medium">{formatMoney(totalAgorot, "he")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">התקבל</dt>
            <dd className="font-medium">{formatMoney(paidAgorot, "he")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">הוחזר</dt>
            <dd className="font-medium">{formatMoney(refundedAgorot, "he")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">יתרה לתשלום</dt>
            <dd className={`font-semibold ${balanceAgorot > 0 ? "text-amber-700" : "text-emerald-700"}`}>{formatMoney(Math.max(balanceAgorot, 0), "he")}</dd>
          </div>
        </dl>

        {payments.length > 0 && (
          <ul className="divide-y text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {p.paid_at} · {METHOD_HE[p.method]}
                  {p.is_deposit && " · מקדמה"}
                  {p.note && <span className="text-muted-foreground"> · {p.note}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className={p.kind === "refund" ? "text-rose-700" : "text-emerald-700"}>
                    {p.kind === "refund" ? "-" : "+"}
                    {formatMoney(p.amount_agorot, "he")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="מחיקה"
                    onClick={() =>
                      start(async () => {
                        const r = await deletePayment(p.id);
                        if (!r.ok) toast.error(r.error);
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <ActionForm action={addPayment} className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-3" resetOnSuccess>
          {() => (
            <>
              <input type="hidden" name="order_id" value={orderId} />
              <div>
                <Label htmlFor="kind" className="text-xs">
                  סוג
                </Label>
                <select id="kind" name="kind" className="mt-1 h-9 w-full rounded-md border border-input bg-white px-2 text-sm" defaultValue="payment">
                  <option value="payment">תשלום</option>
                  <option value="refund">החזר</option>
                </select>
              </div>
              <div>
                <Label htmlFor="amount_ils" className="text-xs">
                  סכום (₪)
                </Label>
                <Input id="amount_ils" name="amount_ils" type="number" min="0.01" step="0.01" dir="ltr" required />
              </div>
              <div>
                <Label htmlFor="method" className="text-xs">
                  אמצעי
                </Label>
                <select id="method" name="method" className="mt-1 h-9 w-full rounded-md border border-input bg-white px-2 text-sm" defaultValue="bit">
                  {Object.entries(METHOD_HE).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="paid_at" className="text-xs">
                  תאריך
                </Label>
                <Input id="paid_at" name="paid_at" type="date" dir="ltr" defaultValue={dateKeyInTz(new Date())} required />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="note" className="text-xs">
                  הערה
                </Label>
                <Input id="note" name="note" />
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" name="is_deposit" /> מקדמה
                </label>
                <SubmitButton size="sm">רישום</SubmitButton>
              </div>
            </>
          )}
        </ActionForm>
        <p className="text-xs text-muted-foreground">התשלום מתבצע מחוץ לאתר (Bit / מזומן / העברה). אין שמירת פרטי כרטיס אשראי.</p>
      </CardContent>
    </Card>
  );
}
