"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { Button } from "@/components/ui/button";
import { ImageFileInput } from "@/components/admin/image-file-input";
import { resetLogo, uploadLogo } from "@/lib/admin/settings-actions";

export function LogoUploader({ hasCustomLogo }: { hasCustomLogo: boolean }) {
  const [, start] = useTransition();
  return (
    <div className="space-y-2">
      <ActionForm action={uploadLogo} className="flex gap-2" resetOnSuccess>
        {() => (
          <>
            <ImageFileInput name="logo" required className="text-xs" />
            <SubmitButton size="sm">החלפה</SubmitButton>
          </>
        )}
      </ActionForm>
      {hasCustomLogo && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() =>
            start(async () => {
              const r = await resetLogo();
              if (!r.ok) toast.error(r.error);
              else toast.success(r.message);
            })
          }
        >
          חזרה ללוגו המקורי מהפרויקט
        </Button>
      )}
      <p className="text-xs text-muted-foreground">מומלץ קובץ ברקע שקוף או בהיר, יחס רוחב/גובה דומה ללוגו המקורי.</p>
    </div>
  );
}
