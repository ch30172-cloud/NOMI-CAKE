"use client";

import { useState, useTransition } from "react";
import { Languages, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteProduct, saveProduct, suggestTranslation, type ProductFormInput } from "@/lib/admin/products-actions";
import { agorotToIls } from "@/lib/pricing/money";
import type { PricingType, ProductRow, ProductVariantRow } from "@/types/database";

interface VariantDraft {
  id?: string;
  label_he: string;
  label_en: string;
  min_quantity: string;
  price_ils: string;
  is_active: boolean;
}

const PRICING: { value: PricingType; label: string; hint: string }[] = [
  { value: "fixed", label: "מחיר קבוע", hint: "מחיר אחד למוצר" },
  { value: "by_size", label: "לפי גודל", hint: "למשל: קטן / בינוני / גדול, לכל גודל מחיר" },
  { value: "by_quantity", label: "לפי כמות", hint: "מחיר ליחידה, עם מדרגות הנחה לפי כמות" },
  { value: "custom", label: "בהתאמה אישית", hint: "יוצג ״מחיר בתיאום אישי״" },
];

export function ProductForm({
  categories,
  translationEnabled,
  product,
  variants = [],
}: {
  categories: { id: string; name_he: string }[];
  translationEnabled: boolean;
  product?: ProductRow;
  variants?: ProductVariantRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [translating, setTranslating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    category_id: product?.category_id ?? "",
    name_he: product?.name_he ?? "",
    name_en: product?.name_en ?? "",
    description_he: product?.description_he ?? "",
    description_en: product?.description_en ?? "",
    en_approved: product?.en_translation_status === "approved",
    slug: product?.slug ?? "",
    pricing_type: (product?.pricing_type ?? "fixed") as PricingType,
    base_price_ils: product?.base_price_agorot != null ? String(agorotToIls(product.base_price_agorot)) : "",
    min_quantity: String(product?.min_quantity ?? 1),
    max_quantity: product?.max_quantity != null ? String(product.max_quantity) : "",
    is_featured: product?.is_featured ?? false,
    is_available: product?.is_available ?? true,
    allow_notes: product?.allow_notes ?? true,
    sort_order: String(product?.sort_order ?? 0),
  });
  const [rows, setRows] = useState<VariantDraft[]>(
    variants.map((v) => ({ id: v.id, label_he: v.label_he, label_en: v.label_en ?? "", min_quantity: v.min_quantity != null ? String(v.min_quantity) : "", price_ils: String(agorotToIls(v.price_agorot)), is_active: v.is_active }))
  );
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const needsVariants = form.pricing_type === "by_size" || form.pricing_type === "by_quantity";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: ProductFormInput = {
      id: product?.id,
      category_id: form.category_id || null,
      name_he: form.name_he,
      name_en: form.name_en,
      description_he: form.description_he,
      description_en: form.description_en,
      en_approved: form.en_approved,
      slug: form.slug,
      pricing_type: form.pricing_type,
      base_price_ils: form.base_price_ils === "" ? null : Number(form.base_price_ils),
      min_quantity: Number(form.min_quantity) || 1,
      max_quantity: form.max_quantity === "" ? null : Number(form.max_quantity),
      is_featured: form.is_featured,
      is_available: form.is_available,
      allow_notes: form.allow_notes,
      sort_order: Number(form.sort_order) || 0,
      variants: needsVariants
        ? rows.map((r) => ({ id: r.id, label_he: r.label_he, label_en: r.label_en, min_quantity: r.min_quantity === "" ? undefined : Number(r.min_quantity), price_ils: Number(r.price_ils) || 0, is_active: r.is_active }))
        : [],
    };
    start(async () => {
      const r = await saveProduct(payload);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message);
      if (!product && r.id) router.push(`/admin/products/${r.id}`);
      else router.refresh();
    });
  }

  async function translate() {
    setTranslating(true);
    const r = await suggestTranslation(form.name_he, form.description_he);
    setTranslating(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setForm((f) => ({ ...f, name_en: r.name, description_en: r.description, en_approved: false }));
    toast.success("הצעת תרגום התקבלה. בדקי, ערכי ואשרי לפני פרסום.");
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">פרטים בעברית</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="name_he">שם המוצר *</Label>
              <Input id="name_he" required value={form.name_he} onChange={(e) => set("name_he", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="description_he">תיאור</Label>
              <Textarea id="description_he" rows={4} value={form.description_he} onChange={(e) => set("description_he", e.target.value)} />
            </div>
            {!product && (
              <div>
                <Label htmlFor="slug">Slug (כתובת, אופציונלי)</Label>
                <Input id="slug" dir="ltr" placeholder="chocolate-layer-cake" value={form.slug} onChange={(e) => set("slug", e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">תרגום לאנגלית</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={translate} disabled={translating || !form.name_he}>
              <Languages className="size-4" /> {translating ? "מתרגם..." : translationEnabled ? "הצע תרגום אוטומטי" : "תרגום אוטומטי (לא מוגדר)"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="name_en">שם באנגלית</Label>
              <Input id="name_en" dir="ltr" value={form.name_en} onChange={(e) => set("name_en", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="description_en">תיאור באנגלית</Label>
              <Textarea id="description_en" dir="ltr" rows={4} value={form.description_en} onChange={(e) => set("description_en", e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="en_approved" checked={form.en_approved} onCheckedChange={(v) => set("en_approved", v)} disabled={!form.name_en} />
              <Label htmlFor="en_approved">התרגום מאושר לפרסום באתר באנגלית</Label>
            </div>
            <p className="text-xs text-muted-foreground">עד לאישור, הגרסה האנגלית של האתר תציג את השם בעברית.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">תמחור</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {PRICING.map((p) => (
                <label key={p.value} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${form.pricing_type === p.value ? "border-accent bg-blush/40" : "border-border"}`}>
                  <input type="radio" name="pricing_type" value={p.value} checked={form.pricing_type === p.value} onChange={() => set("pricing_type", p.value)} className="mt-1" />
                  <span>
                    <span className="block font-medium">{p.label}</span>
                    <span className="text-xs text-muted-foreground">{p.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {(form.pricing_type === "fixed" || form.pricing_type === "by_quantity") && (
              <div>
                <Label htmlFor="base_price_ils">{form.pricing_type === "fixed" ? "מחיר (₪) *" : "מחיר ליחידה בסיסי (₪) – לפני מדרגות"}</Label>
                <Input id="base_price_ils" type="number" min="0" step="0.5" dir="ltr" value={form.base_price_ils} onChange={(e) => set("base_price_ils", e.target.value)} required={form.pricing_type === "fixed"} />
              </div>
            )}
            {needsVariants && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{form.pricing_type === "by_size" ? "גדלים" : "מדרגות כמות (מחיר ליחידה החל מכמות)"}</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setRows((r) => [...r, { label_he: "", label_en: "", min_quantity: "", price_ils: "", is_active: true }])}>
                    <Plus className="size-4" /> הוספה
                  </Button>
                </div>
                {rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-end gap-2 rounded-lg border p-2">
                    <div>
                      <Label className="text-xs">שם (עברית)</Label>
                      <Input value={r.label_he} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, label_he: e.target.value } : x)))} placeholder={form.pricing_type === "by_size" ? "בינוני" : "6 יחידות"} />
                    </div>
                    <div>
                      <Label className="text-xs">שם (אנגלית)</Label>
                      <Input dir="ltr" value={r.label_en} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, label_en: e.target.value } : x)))} />
                    </div>
                    {form.pricing_type === "by_quantity" ? (
                      <div>
                        <Label className="text-xs">מכמות</Label>
                        <Input type="number" min="1" dir="ltr" className="w-20" value={r.min_quantity} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, min_quantity: e.target.value } : x)))} />
                      </div>
                    ) : (
                      <span />
                    )}
                    <div>
                      <Label className="text-xs">₪</Label>
                      <Input type="number" min="0" step="0.5" dir="ltr" className="w-24" value={r.price_ils} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, price_ils: e.target.value } : x)))} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label="הסרה">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="min_quantity">כמות מינימלית</Label>
                <Input id="min_quantity" type="number" min="1" dir="ltr" value={form.min_quantity} onChange={(e) => set("min_quantity", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="max_quantity">כמות מקסימלית (ריק = ללא)</Label>
                <Input id="max_quantity" type="number" min="1" dir="ltr" value={form.max_quantity} onChange={(e) => set("max_quantity", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">תצוגה</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="category_id">קטגוריה</Label>
              <select id="category_id" className="mt-1 h-9 w-full rounded-md border border-input bg-white px-3 text-sm" value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
                <option value="">ללא קטגוריה</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_he}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_available">זמין להזמנה</Label>
              <Switch id="is_available" checked={form.is_available} onCheckedChange={(v) => set("is_available", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_featured">מוצר מומלץ (דף הבית)</Label>
              <Switch id="is_featured" checked={form.is_featured} onCheckedChange={(v) => set("is_featured", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="allow_notes">לאפשר הערות ללקוח</Label>
              <Switch id="allow_notes" checked={form.allow_notes} onCheckedChange={(v) => set("allow_notes", v)} />
            </div>
            <div>
              <Label htmlFor="sort_order">סדר תצוגה</Label>
              <Input id="sort_order" type="number" dir="ltr" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
            </div>
          </CardContent>
        </Card>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "שומר..." : product ? "שמירת שינויים" : "יצירת מוצר"}
        </Button>
        {product &&
          (confirmDelete ? (
            <div className="rounded-lg border border-destructive/40 p-3 text-sm">
              <p className="mb-2">למחוק את המוצר? הזמנות קיימות ישמרו את פרטיו.</p>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" size="sm" onClick={() => start(async () => { const r = await deleteProduct(product.id); if (r && !r.ok) toast.error(r.error); })}>
                  כן, למחוק
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  ביטול
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="ghost" className="w-full text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> מחיקת מוצר
            </Button>
          ))}
      </div>
    </form>
  );
}
