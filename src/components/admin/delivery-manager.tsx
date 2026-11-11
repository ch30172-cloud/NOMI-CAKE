"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteDeliveryCity, saveDeliveryCity, toggleDeliveryCity } from "@/lib/admin/delivery-actions";
import { agorotToIls, formatMoney } from "@/lib/pricing/money";
import type { DeliveryCityRow } from "@/types/database";

export function DeliveryManager({ cities }: { cities: DeliveryCityRow[] }) {
  const [editing, setEditing] = useState<DeliveryCityRow | "new" | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [, start] = useTransition();
  const c = editing && editing !== "new" ? editing : null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" /> הוספת עיר
        </Button>
      </div>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{c ? `עריכה: ${c.name_he}` : "עיר חדשה"}</DialogTitle>
          </DialogHeader>
          <ActionForm action={saveDeliveryCity} className="space-y-3">
            {() => (
              <>
                {c && <input type="hidden" name="id" value={c.id} />}
                <div>
                  <Label htmlFor="name_he">שם העיר (עברית) *</Label>
                  <Input id="name_he" name="name_he" required defaultValue={c?.name_he ?? ""} />
                </div>
                <div>
                  <Label htmlFor="name_en">שם באנגלית</Label>
                  <Input id="name_en" name="name_en" dir="ltr" defaultValue={c?.name_en ?? ""} />
                </div>
                <div>
                  <Label htmlFor="fee_ils">מחיר משלוח (₪) *</Label>
                  <Input id="fee_ils" name="fee_ils" type="number" step="0.01" min="0" required dir="ltr" defaultValue={c ? agorotToIls(c.fee_agorot) : ""} />
                </div>
                <div>
                  <Label htmlFor="sort_order">סדר תצוגה</Label>
                  <Input id="sort_order" name="sort_order" type="number" dir="ltr" defaultValue={c?.sort_order ?? 0} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="is_active" name="is_active" defaultChecked={c?.is_active ?? true} />
                  <Label htmlFor="is_active">משלוחים פעילים לעיר זו</Label>
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

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>עיר</TableHead>
              <TableHead>מחיר משלוח</TableHead>
              <TableHead>פעיל</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cities.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  אין ערים עדיין. עד שתתווסף עיר, לקוחות יוכלו לבחור איסוף עצמי בלבד.
                </TableCell>
              </TableRow>
            )}
            {cities.map((city) => (
              <TableRow key={city.id}>
                <TableCell>
                  {city.name_he} {city.name_en && <span className="text-xs text-muted-foreground" dir="ltr">· {city.name_en}</span>}
                </TableCell>
                <TableCell>{formatMoney(city.fee_agorot, "he")}</TableCell>
                <TableCell>
                  <Switch
                    checked={city.is_active}
                    onCheckedChange={(v) =>
                      start(async () => {
                        const r = await toggleDeliveryCity(city.id, v);
                        if (!r.ok) toast.error(r.error);
                      })
                    }
                  />
                </TableCell>
                <TableCell className="text-end">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(city)} aria-label="עריכה">
                    <Pencil className="size-4" />
                  </Button>
                  {confirm === city.id ? (
                    <span className="inline-flex items-center gap-1 text-xs">
                      למחוק?
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          start(async () => {
                            const r = await deleteDeliveryCity(city.id);
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
                    <Button variant="ghost" size="icon" onClick={() => setConfirm(city.id)} aria-label="מחיקה">
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
