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

export function OrderStatusActions({
  orderId,
  status,
  confirmWhatsAppLink,
  hasEmail,
}: {
  orderId: string;
  status: OrderStatus;
  confirmWhatsAppLink: string;
  hasEmail: boolean;
}) {
  const [pending, start] = useTransition();
  const options = NEXT[status];
  if (options.length === 0) return <p className="text-sm text-muted-foreground">אין מעברי סטטוס נוספים.</p>;

  function change(s: OrderStatus) {
    // Open the WhatsApp tab during the click itself (browsers block pop-ups opened later),
    // then point it at the message once the status change succeeded.
    const waTab = s === "confirmed" ? window.open("about:blank", "_blank") : null;
    start(async () => {
      const r = await updateOrderStatus(orderId, s);
      if (!r.ok) {
        waTab?.close();
        toast.error(r.error);
        return;
      }
      if (s === "confirmed") {
        if (waTab) waTab.location.href = confirmWhatsAppLink;
        else window.location.href = confirmWhatsAppLink;
        toast.success(hasEmail ? "ההזמנה אושרה. נפתח WhatsApp עם ההודעה ללקוח, ונשלח גם אימייל." : "ההזמנה אושרה. נפתח WhatsApp עם ההודעה ללקוח, לחצי שם על שליחה.");
      } else {
        toast.success(r.message);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((s) => (
          <Button key={s} size="sm" variant={s === "cancelled" ? "destructive" : s === "pending" ? "outline" : "default"} disabled={pending} onClick={() => change(s)}>
            {s === "cancelled" ? "ביטול הזמנה" : s === "pending" ? "פתיחה מחדש" : s === "confirmed" ? "אישור ההזמנה ושליחת הודעה ללקוח" : `סימון: ${STATUS_HE[s]}`}
          </Button>
        ))}
      </div>
      {status === "pending" && (
        <p className="text-xs text-muted-foreground">
          באישור ייפתח WhatsApp עם ההודעה &quot;הזמנתך התקבלה בהצלחה&quot; ואפשרויות התשלום. ההודעה נשלחת רק אחרי שתלחצי שם על שליחה.
        </p>
      )}
    </div>
  );
}
