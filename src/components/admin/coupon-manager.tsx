"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { deleteCoupon, saveCoupon, toggleCoupon } from "@/lib/admin/coupons-actions";
import { agorotToIls, formatMoney } from "@/lib/pricing/money";
import type { CouponRow, CouponScope, DiscountType } from "@/types/database";

type Opt = { id: string; name_he: string };

function describe(c: CouponRow): string {
  const d = c.discount_type === "percent" ? `${c.value}%` : c.discount_type === "fixed" ? formatMoney(c.value, "he") : "משלוח חינם";
  const s = c.scope === "order" ? "על ההזמנה" : c.scope === "product" ? "על מוצר" : "על קטגוריה";
  return `${d} ${s}`;
}

export function CouponManager({ coupons, products, categories }: { coupons: CouponRow[]; products: Opt[]; categories: Opt[] }) {
  const [editing, setEditing] = useState<CouponRow | "new" | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [, start] = useTransition();
  const c = editing && editing !== "new" ? editing : null;
  const [type, setType] = useState<DiscountType>("percent");
  const [scope, setScope] = useState<CouponScope>("order");

  function open(x: CouponRow | "new") {
    setEditing(x);
    setType(x === "new" ? "percent" : x.discount_type);
    setScope(x === "new" ? "order" : x.scope);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => open("new")}>
          <Plus className="size-4" /> קופון חדש
        </Button>
      </div>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{c ? `עריכה: ${c.code}` : "קופון חדש"}</DialogTitle>
          </DialogHeader>
          <ActionForm action={saveCoupon} className="space-y-3">
            {() => (
              <>
                {c && <input type="hidden" name="id" value={c.id} />}
                <div>
                  <Label htmlFor="code">קוד *</Label>
                  <Input id="code" name="code" dir="ltr" required className="uppercase" defaultValue={c?.code ?? ""} placeholder="WELCOME10" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="discount_type">סוג הנחה</Label>
                    <select id="discount_type" name="discount_type" className="mt-1 h-9 w-full rounded-md border border-input bg-white px-2 text-sm" value={type} onChange={(e) => setType(e.target.value as DiscountType)}>
                      <option value="percent">אחוזים</option>
                      <option value="fixed">סכום קבוע</option>
                      <option value="free_delivery">משלוח חינם</option>
                    </select>
                  </div>
                  {type !== "free_delivery" && (
                    <div>
                      <Label htmlFor="value">{type === "percent" ? "אחוז הנחה" : "סכום הנחה (₪)"}</Label>
                      <Input id="value" name="value" type="number" min="0" step={type === "percent" ? "1" : "0.5"} dir="ltr" required defaultValue={c ? (c.discount_type === "fixed" ? agorotToIls(c.value) : c.value) : ""} />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="scope">תחולה</Label>
                    <select id="scope" name="scope" className="mt-1 h-9 w-full rounded-md border border-input bg-white px-2 text-sm" value={scope} onChange={(e) => setScope(e.target.value as CouponScope)}>
                      <option value="order">כל ההזמנה</option>
                      <option value="product">מוצר מסוים</option>
                      <option value="category">קטגוריה מסוימת</option>
                    </select>
                  </div>
                  {scope === "product" && (
                    <div>
                      <Label htmlFor="product_id">מוצר</Label>
                      <select id="product_id" name="product_id" className="mt-1 h-9 w-full rounded-md border border-input bg-white px-2 text-sm" defaultValue={c?.product_id ?? ""}>
                        <option value="">בחרי</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name_he}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {scope === "category" && (
                    <div>
                      <Label htmlFor="category_id">קטגוריה</Label>
                      <select id="category_id" name="category_id" className="mt-1 h-9 w-full rounded-md border border-input bg-white px-2 text-sm" defaultValue={c?.category_id ?? ""}>
                        <option value="">בחרי</option>
                        {categories.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name_he}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="min_order_ils">הזמנה מינימלית (₪)</Label>
                    <Input id="min_order_ils" name="min_order_ils" type="number" min="0" step="0.5" dir="ltr" defaultValue={c ? agorotToIls(c.min_order_agorot) : 0} />
                  </div>
                  <div>
                    <Label htmlFor="max_redemptions">מספר שימושים מרבי (ריק = ללא הגבלה)</Label>
                    <Input id="max_redemptions" name="max_redemptions" type="number" min="0" dir="ltr" defaultValue={c?.max_redemptions ?? ""} />
                  </div>
                  <div>
                    <Label htmlFor="starts_at">תאריך התחלה</Label>
                    <Input id="starts_at" name="starts_at" type="date" dir="ltr" defaultValue={c?.starts_at ? c.starts_at.slice(0, 10) : ""} />
                  </div>
                  <div>
                    <Label htmlFor="expires_at">תאריך תפוגה</Label>
                    <Input id="expires_at" name="expires_at" type="date" dir="ltr" defaultValue={c?.expires_at ? c.expires_at.slice(0, 10) : ""} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="terms_he">תנאי שימוש (עברית)</Label>
                  <Textarea id="terms_he" name="terms_he" rows={2} defaultValue={c?.terms_he ?? ""} />
                </div>
                <div>
                  <Label htmlFor="terms_en">תנאי שימוש (אנגלית)</Label>
                  <Textarea id="terms_en" name="terms_en" rows={2} dir="ltr" defaultValue={c?.terms_en ?? ""} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="is_active" name="is_active" defaultChecked={c?.is_active ?? true} />
                  <Label htmlFor="is_active">פעיל</Label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                    ביטול
                  </Button>
                  <SubmitButton>שמירה</SubmitButton>
                </div>
              </>
            )}
          </ActionForm>
        </DialogContent>
      </Dialog>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>קוד</TableHead>
              <TableHead>הנחה</TableHead>
              <TableHead>תנאים</TableHead>
              <TableHead>שימושים</TableHead>
              <TableHead>פעיל</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  אין קופונים.
                </TableCell>
              </TableRow>
            )}
            {coupons.map((cp) => {
              const expired = cp.expires_at ? new Date(cp.expires_at) < new Date() : false;
              return (
                <TableRow key={cp.id}>
                  <TableCell className="font-mono" dir="ltr">
                    {cp.code}
                  </TableCell>
                  <TableCell>{describe(cp)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {cp.min_order_agorot > 0 && <span>מינימום {formatMoney(cp.min_order_agorot, "he")} · </span>}
                    {cp.starts_at && <span>מ-{cp.starts_at.slice(0, 10)} · </span>}
                    {cp.expires_at && <span className={expired ? "text-rose-700" : ""}>עד {cp.expires_at.slice(0, 10)}</span>}
                  </TableCell>
                  <TableCell>
                    {cp.redemption_count}
                    {cp.max_redemptions !== null && ` / ${cp.max_redemptions}`}
                    {cp.max_redemptions !== null && cp.redemption_count >= cp.max_redemptions && <Badge variant="secondary" className="ms-1">נוצל</Badge>}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={cp.is_active}
                      onCheckedChange={(v) =>
                        start(async () => {
                          const r = await toggleCoupon(cp.id, v);
                          if (!r.ok) toast.error(r.error);
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-end">
                    <Button variant="ghost" size="icon" onClick={() => open(cp)} aria-label="עריכה">
                      <Pencil className="size-4" />
                    </Button>
                    {confirm === cp.id ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        למחוק?
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            start(async () => {
                              const r = await deleteCoupon(cp.id);
                              if (!r.ok) toast.error(r.error);
                              setConfirm(null);
                            })
                          }
                        >
                          כן
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                          לא
                        </Button>
                      </span>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => setConfirm(cp.id)} aria-label="מחיקה">
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
