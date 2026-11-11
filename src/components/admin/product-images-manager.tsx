"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteProductImage, reorderProductImages, uploadProductImage } from "@/lib/admin/products-actions";
import type { ProductImageRow } from "@/types/database";

export function ProductImagesManager({ productId, images }: { productId: string; images: ProductImageRow[] }) {
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("image", file);
      const r = await uploadProductImage(productId, fd);
      if (!r.ok) toast.error(r.error);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function move(i: number, dir: -1 | 1) {
    const ids = images.map((x) => x.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    start(async () => {
      const r = await reorderProductImages(ids);
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-rose/40 bg-white p-6 text-sm text-muted-foreground hover:bg-secondary/40">
        <Upload className="size-5" />
        {uploading ? "מעלה..." : "לחצי לבחירת תמונות (JPG / PNG / WEBP, עד 8MB)"}
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={(e) => onFiles(e.target.files)} />
      </label>
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="group relative aspect-square overflow-hidden rounded-xl bg-blush/40">
              <Image src={img.url} alt="" fill sizes="200px" className="object-cover" unoptimized />
              {i === 0 && <span className="absolute start-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">ראשית</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="icon" variant="ghost" className="size-7 text-white" disabled={pending || i === 0} onClick={() => move(i, -1)} aria-label="הזזה">
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-white"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await deleteProductImage(img.id);
                      if (!r.ok) toast.error(r.error);
                    })
                  }
                  aria-label="מחיקה"
                >
                  <Trash2 className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" className="size-7 text-white" disabled={pending || i === images.length - 1} onClick={() => move(i, 1)} aria-label="הזזה">
                  <ArrowLeft className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
