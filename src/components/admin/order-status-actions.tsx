"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateOrderStatus } from "@/lib/admin/orders-actions";
import type { OrderStatus } from "@/types/database";
import { STATUS_HE } from "./status-badge";

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_preparation", "ready", "completed", "cancelled"],
  in_preparation: ["ready", "completed", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: ["pending"],
};

export function OrderStatusActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [pending, start] = useTransition();
  const options = NEXT[status];
  if (options.length === 0) return <p className="text-sm text-muted-foreground">אין מעברי סטטוס נוספים.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((s) => (
        <Button
          key={s}
          size="sm"
          variant={s === "cancelled" ? "destructive" : s === "pending" ? "outline" : "default"}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateOrderStatus(orderId, s);
              if (!r.ok) toast.error(r.error);
              else toast.success(r.message);
            })
          }
        >
          {s === "cancelled" ? "ביטול הזמנה" : s === "pending" ? "פתיחה מחדש" : `סימון: ${STATUS_HE[s]}`}
        </Button>
      ))}
    </div>
  );
}
