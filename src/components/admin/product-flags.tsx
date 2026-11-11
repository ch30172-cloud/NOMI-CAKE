"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { TableCell } from "@/components/ui/table";
import { toggleProductFlag } from "@/lib/admin/products-actions";

export function ProductFlags({ id, isFeatured, isAvailable }: { id: string; isFeatured: boolean; isAvailable: boolean }) {
  const [pending, start] = useTransition();
  const toggle = (field: "is_featured" | "is_available", value: boolean) =>
    start(async () => {
      const r = await toggleProductFlag(id, field, value);
      if (!r.ok) toast.error(r.error);
    });
  return (
    <>
      <TableCell>
        <Switch checked={isFeatured} disabled={pending} onCheckedChange={(v) => toggle("is_featured", v)} aria-label="מומלץ" />
      </TableCell>
      <TableCell>
        <Switch checked={isAvailable} disabled={pending} onCheckedChange={(v) => toggle("is_available", v)} aria-label="זמין" />
      </TableCell>
    </>
  );
}
