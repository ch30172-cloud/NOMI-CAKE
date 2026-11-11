"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { addGalleryImages, deleteGalleryImage, reorderGallery, saveHomepage, toggleGalleryImage } from "@/lib/admin/content-actions";
import type { GalleryImageRow, HomepageContentRow } from "@/types/database";

export function ContentManager({ content, gallery }: { content: HomepageContentRow; gallery: GalleryImageRow[] }) {
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function move(i: number, dir: -1 | 1) {
    const ids = gallery.map((g) => g.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    start(async () => {
      const r = await reorderGallery(ids);
      if (!r.ok) toast.error(r.error);
    });
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("images", f);
    const r = await addGalleryImages(fd);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!r.ok) toast.error(r.error);
    else toast.success(r.message);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">דף הבית</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={saveHomepage} className="grid gap-4 md:grid-cols-2">
            {() => (
              <>
                <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>תמונת פתיחה (Hero)</Label>
                    {content.hero_image_url && (
                      <div className="relative mt-1 aspect-[3/1] overflow-hidden rounded-lg bg-blush/40">
                        <Image src={content.hero_image_url} alt="" fill className="object-cover" sizes="400px" unoptimized />
                      </div>
                    )}
                    <Input type="file" name="hero_image" accept="image/*" className="mt-2" />
                  </div>
                  <div>
                    <Label>תמונה לאזור ״קצת על העסק״</Label>
                    {content.about_image_url && (
                      <div className="relative mt-1 aspect-[3/1] overflow-hidden rounded-lg bg-blush/40">
                        <Image src={content.about_image_url} alt="" fill className="object-cover" sizes="400px" unoptimized />
                      </div>
                    )}
                    <Input type="file" name="about_image" accept="image/*" className="mt-2" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="hero_title_he">כותרת ראשית (עברית)</Label>
                  <Input id="hero_title_he" name="hero_title_he" defaultValue={content.hero_title_he ?? ""} />
                </div>
                <div>
                  <Label htmlFor="hero_title_en">כותרת ראשית (אנגלית)</Label>
                  <Input id="hero_title_en" name="hero_title_en" dir="ltr" defaultValue={content.hero_title_en ?? ""} />
                </div>
                <div>
                  <Label htmlFor="hero_subtitle_he">טקסט פתיחה (עברית)</Label>
                  <Textarea id="hero_subtitle_he" name="hero_subtitle_he" rows={2} defaultValue={content.hero_subtitle_he ?? ""} />
                </div>
                <div>
                  <Label htmlFor="hero_subtitle_en">טקסט פתיחה (אנגלית)</Label>
                  <Textarea id="hero_subtitle_en" name="hero_subtitle_en" rows={2} dir="ltr" defaultValue={content.hero_subtitle_en ?? ""} />
                </div>
                <div>
                  <Label htmlFor="about_title_he">כותרת ״קצת על העסק״ (עברית)</Label>
                  <Input id="about_title_he" name="about_title_he" defaultValue={content.about_title_he ?? ""} />
                </div>
                <div>
                  <Label htmlFor="about_title_en">כותרת ״קצת על העסק״ (אנגלית)</Label>
                  <Input id="about_title_en" name="about_title_en" dir="ltr" defaultValue={content.about_title_en ?? ""} />
                </div>
                <div>
                  <Label htmlFor="about_he">קצת על העסק (עברית)</Label>
                  <Textarea id="about_he" name="about_he" rows={6} defaultValue={content.about_he ?? ""} />
                </div>
                <div>
                  <Label htmlFor="about_en">קצת על העסק (אנגלית)</Label>
                  <Textarea id="about_en" name="about_en" rows={6} dir="ltr" defaultValue={content.about_en ?? ""} />
                </div>
                <div className="md:col-span-2">
                  <SubmitButton>שמירה</SubmitButton>
                </div>
              </>
            )}
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">גלריית תמונות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-rose/40 bg-white p-6 text-sm text-muted-foreground hover:bg-secondary/40">
            <Upload className="size-5" />
            {uploading ? "מעלה..." : "העלאת תמונות לגלריה"}
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files)} />
          </label>
          {gallery.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {gallery.map((g, i) => (
                <li key={g.id} className={`relative aspect-square overflow-hidden rounded-xl bg-blush/40 ${g.is_active ? "" : "opacity-50"}`}>
                  <Image src={g.url} alt="" fill sizes="200px" className="object-cover" unoptimized />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/50 px-1 py-0.5">
                    <Button size="icon" variant="ghost" className="size-6 text-white" disabled={pending || i === 0} onClick={() => move(i, -1)} aria-label="הזזה">
                      <ArrowRight className="size-3.5" />
                    </Button>
                    <Switch
                      checked={g.is_active}
                      className="scale-75"
                      onCheckedChange={(v) =>
                        start(async () => {
                          const r = await toggleGalleryImage(g.id, v);
                          if (!r.ok) toast.error(r.error);
                        })
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6 text-white"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await deleteGalleryImage(g.id);
                          if (!r.ok) toast.error(r.error);
                        })
                      }
                      aria-label="מחיקה"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-6 text-white" disabled={pending || i === gallery.length - 1} onClick={() => move(i, 1)} aria-label="הזזה">
                      <ArrowLeft className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
