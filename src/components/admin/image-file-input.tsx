"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/client/compress-image";

/**
 * File input for forms posted to server actions. When a photo is chosen it is
 * shrunk in the browser and swapped back into the input, so the form submits
 * the small version.
 */
export function ImageFileInput(props: Omit<React.ComponentProps<typeof Input>, "type" | "onChange">) {
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <Input
        {...props}
        type="file"
        accept="image/*"
        disabled={busy || props.disabled}
        onChange={async (e) => {
          const input = e.currentTarget;
          const files = Array.from(input.files ?? []);
          if (!files.length) return;
          setBusy(true);
          try {
            const small = await Promise.all(files.map((f) => compressImage(f)));
            const dt = new DataTransfer();
            small.forEach((f) => dt.items.add(f));
            input.files = dt.files;
          } finally {
            setBusy(false);
          }
        }}
      />
      {busy && <p className="mt-1 text-xs text-muted-foreground">מכין את התמונה...</p>}
    </div>
  );
}
