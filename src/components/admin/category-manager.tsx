"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteCategory, reorderCategories, saveCategory, toggleCategory } from "@/lib/admin/categories-actions";
import type { CategoryRow } from "@/types/database";

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const [editing, setEditing] = useState<CategoryRow | null | "new">(null);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function move(index: number, dir: -1 | 1) {
    const ids = categories.map((c) => c.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    start(async () => {
      const r = await reorderCategories(ids);
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> קטגוריה חדשה
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing === "new" || !editing ? "קטגוריה חדשה" : `עריכה: ${editing.name_he}`}</DialogTitle>
            </DialogHeader>
            <ActionForm action={saveCategory} className="space-y-3">
              {() => {
                const c = editing && editing !== "new" ? editing : null;
                return (
                  <>
                    {c && <input type="hidden" name="id" value={c.id} />}
                    <div>
                      <Label htmlFor="name_he">שם בעברית *</Label>
                      <Input id="name_he" name="name_he" required defaultValue={c?.name_he ?? ""} />
                    </div>
                    <div>
                      <Label htmlFor="name_en">שם באנגלית</Label>
                      <Input id="name_en" name="name_en" dir="ltr" defaultValue={c?.name_en ?? ""} />
                    </div>
                    <div>
                      <Label htmlFor="description_he">תיאור בעברית</Label>
                      <Textarea id="description_he" name="description_he" defaultValue={c?.description_he ?? ""} />
                    </div>
                    <div>
                      <Label htmlFor="description_en">תיאור באנגלית</Label>
                      <Textarea id="description_en" name="description_en" dir="ltr" defaultValue={c?.description_en ?? ""} />
                    </div>
                    {!c && (
                      <div>
                        <Label htmlFor="slug">Slug (כתובת URL, אופציונלי)</Label>
                        <Input id="slug" name="slug" dir="ltr" placeholder="layer-cakes" />
                      </div>
                    )}
                    <div>
                      <Label htmlFor="image">תמונה</Label>
                      <Input id="image" name="image" type="file" accept="image/*" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="is_active" name="is_active" defaultChecked={c?.is_active ?? true} />
                      <Label htmlFor="is_active">פעילה (מוצגת באתר)</Label>
                    </div>
                    <input type="hidden" name="sort_order" value={c?.sort_order ?? categories.length + 1} />
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                        ביטול
                      </Button>
                      <SubmitButton>שמירה</SubmitButton>
                    </div>
                  </>
                );
              }}
            </ActionForm>
          </DialogContent>
        </Dialog>
      </div>

      {categories.length === 0 ? (
        <p className="rounded-xl bg-muted p-8 text-center text-sm text-muted-foreground">אין קטגוריות עדיין.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {categories.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="flex flex-col">
                <button type="button" className="text-muted-foreground disabled:opacity-30" disabled={i === 0 || pending} onClick={() => move(i, -1)} aria-label="למעלה">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" className="text-muted-foreground disabled:opacity-30" disabled={i === categories.length - 1 || pending} onClick={() => move(i, 1)} aria-label="למטה">
                  <ArrowDown className="size-4" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {c.name_he} {c.name_en && <span className="text-sm text-muted-foreground" dir="ltr">· {c.name_en}</span>}
                </p>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  /products?category={c.slug}
                </p>
              </div>
              {!c.is_active && <Badge variant="secondary">מוסתרת</Badge>}
              <div className="flex items-center gap-2">
                <Switch
                  checked={c.is_active}
                  onCheckedChange={(v) =>
                    start(async () => {
                      const r = await toggleCategory(c.id, v);
                      if (!r.ok) toast.error(r.error);
                    })
                  }
                  aria-label="פעילה"
                />
                <Button variant="ghost" size="icon" onClick={() => setEditing(c)} aria-label="עריכה">
                  <Pencil className="size-4" />
                </Button>
                {confirmDelete === c.id ? (
                  <div className="flex items-center gap-1 text-xs">
                    <span>למחוק?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        start(async () => {
                          const r = await deleteCategory(c.id);
                          if (!r.ok) toast.error(r.error);
                          else toast.success(r.message);
                          setConfirmDelete(null);
                        })
                      }
                    >
                      כן
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                      לא
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(c.id)} aria-label="מחיקה">
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
