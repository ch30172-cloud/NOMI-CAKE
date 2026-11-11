import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrderStatus, PaymentStatus } from "@/types/database";

export const STATUS_HE: Record<OrderStatus, string> = {
  pending: "ממתינה לאישור",
  confirmed: "אושרה",
  in_preparation: "בהכנה",
  ready: "מוכנה",
  completed: "הושלמה",
  cancelled: "בוטלה",
};

export const PAYMENT_HE: Record<PaymentStatus, string> = {
  unpaid: "ממתין לתשלום",
  deposit_paid: "שולמה מקדמה",
  partially_paid: "שולם חלקית",
  paid: "שולם במלואו",
  refunded: "הוחזר",
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  confirmed: "bg-sky-100 text-sky-900",
  in_preparation: "bg-violet-100 text-violet-900",
  ready: "bg-emerald-100 text-emerald-900",
  completed: "bg-neutral-200 text-neutral-800",
  cancelled: "bg-rose-100 text-rose-900",
};

const PAYMENT_CLASS: Record<PaymentStatus, string> = {
  unpaid: "bg-neutral-100 text-neutral-700",
  deposit_paid: "bg-sky-100 text-sky-900",
  partially_paid: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-900",
  refunded: "bg-rose-100 text-rose-900",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge className={cn("rounded-full border-0", STATUS_CLASS[status])}>{STATUS_HE[status]}</Badge>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge className={cn("rounded-full border-0", PAYMENT_CLASS[status])}>{PAYMENT_HE[status]}</Badge>;
}
