import { formatMoney } from "@/lib/pricing/money";
import { toWhatsAppDigits } from "./phone";
import type { FulfillmentType, OrderStatus } from "@/types/database";

export interface WhatsAppOrderItem {
  name: string;
  variant?: string | null;
  quantity: number;
  lineTotalAgorot: number | null;
  notes?: string | null;
}

export interface WhatsAppOrder {
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  items: WhatsAppOrderItem[];
  fulfillment: FulfillmentType;
  deliveryCityName?: string | null;
  deliveryAddress?: string | null;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  subtotalAgorot: number;
  discountAgorot: number;
  couponCode?: string | null;
  deliveryFeeAgorot: number;
  totalAgorot: number;
  hasCustomPricing: boolean;
  notes?: string | null;
}

const T = {
  he: {
    title: "הזמנה חדשה",
    order: "מספר הזמנה",
    name: "שם",
    phone: "טלפון",
    items: "פריטים",
    qty: "כמות",
    toBeQuoted: "מחיר בתיאום אישי",
    fulfillment: "אופן קבלה",
    pickup: "איסוף עצמי",
    delivery: "משלוח",
    address: "כתובת",
    date: "תאריך",
    time: "שעה",
    subtotal: "סכום ביניים",
    discount: "הנחה",
    coupon: "קופון",
    deliveryFee: "משלוח",
    total: "סה״כ",
    partialTotal: "סכום ידוע (ללא פריטים בתיאום אישי)",
    notes: "הערות",
    note: "הערה",
  },
  en: {
    title: "New order",
    order: "Order no.",
    name: "Name",
    phone: "Phone",
    items: "Items",
    qty: "Qty",
    toBeQuoted: "price to be agreed",
    fulfillment: "Fulfillment",
    pickup: "Pickup",
    delivery: "Delivery",
    address: "Address",
    date: "Date",
    time: "Time",
    subtotal: "Subtotal",
    discount: "Discount",
    coupon: "Coupon",
    deliveryFee: "Delivery",
    total: "Total",
    partialTotal: "Known amount (excluding items to be quoted)",
    notes: "Notes",
    note: "Note",
  },
} as const;

export function buildOrderMessage(order: WhatsAppOrder, locale: "he" | "en"): string {
  const t = T[locale];
  const lines: string[] = [];
  lines.push(`${t.title} – ${t.order} #${order.orderNumber}`);
  lines.push(`${t.name}: ${order.customerName}`);
  lines.push(`${t.phone}: ${order.customerPhone}`);
  lines.push("");
  lines.push(`${t.items}:`);
  for (const item of order.items) {
    const variant = item.variant ? ` (${item.variant})` : "";
    const price = item.lineTotalAgorot === null ? t.toBeQuoted : formatMoney(item.lineTotalAgorot, locale);
    lines.push(`• ${item.name}${variant} × ${item.quantity} – ${price}`);
    if (item.notes) lines.push(`  ${t.note}: ${item.notes}`);
  }
  lines.push("");
  lines.push(`${t.fulfillment}: ${order.fulfillment === "pickup" ? t.pickup : t.delivery}`);
  if (order.fulfillment === "delivery") {
    lines.push(`${t.address}: ${[order.deliveryAddress, order.deliveryCityName].filter(Boolean).join(", ")}`);
  }
  lines.push(`${t.date}: ${order.scheduledDate}  ${t.time}: ${order.scheduledTime}`);
  lines.push("");
  lines.push(`${t.subtotal}: ${formatMoney(order.subtotalAgorot, locale)}`);
  if (order.discountAgorot > 0) {
    const code = order.couponCode ? ` (${t.coupon} ${order.couponCode})` : "";
    lines.push(`${t.discount}${code}: -${formatMoney(order.discountAgorot, locale)}`);
  }
  if (order.fulfillment === "delivery") lines.push(`${t.deliveryFee}: ${formatMoney(order.deliveryFeeAgorot, locale)}`);
  lines.push(`${order.hasCustomPricing ? t.partialTotal : t.total}: ${formatMoney(order.totalAgorot, locale)}`);
  if (order.notes) {
    lines.push("");
    lines.push(`${t.notes}: ${order.notes}`);
  }
  return lines.join("\n");
}

export function buildWhatsAppLink(phoneE164: string, message: string): string {
  return `https://wa.me/${toWhatsAppDigits(phoneE164)}?text=${encodeURIComponent(message)}`;
}

const STATUS_MESSAGES: Record<"he" | "en", Record<OrderStatus, (n: number, name: string) => string>> = {
  he: {
    pending: (n, name) => `שלום ${name}, קיבלנו את הזמנה #${n} ונחזור אלייך בהקדם לאישור. תודה!`,
    confirmed: (n, name) => `שלום ${name}, הזמנה #${n} אושרה 🎂 נשמח לקבל מקדמה לפי הסיכום. תודה!`,
    in_preparation: (n, name) => `שלום ${name}, הזמנה #${n} בהכנה 👩‍🍳`,
    ready: (n, name) => `שלום ${name}, הזמנה #${n} מוכנה! ניתן לאסוף / המשלוח בדרך.`,
    completed: (n, name) => `שלום ${name}, תודה על הזמנה #${n}! נשמח לשמוע איך היה 💗`,
    cancelled: (n, name) => `שלום ${name}, הזמנה #${n} בוטלה. לכל שאלה אנחנו כאן.`,
  },
  en: {
    pending: (n, name) => `Hi ${name}, we received order #${n} and will get back to you shortly to confirm. Thank you!`,
    confirmed: (n, name) => `Hi ${name}, order #${n} is confirmed 🎂 We'd appreciate the deposit as agreed. Thank you!`,
    in_preparation: (n, name) => `Hi ${name}, order #${n} is being prepared 👩‍🍳`,
    ready: (n, name) => `Hi ${name}, order #${n} is ready! Pickup is available / delivery is on its way.`,
    completed: (n, name) => `Hi ${name}, thank you for order #${n}! We'd love to hear how it was 💗`,
    cancelled: (n, name) => `Hi ${name}, order #${n} was cancelled. We're here for any question.`,
  },
};

export function buildStatusMessage(status: OrderStatus, orderNumber: number, customerName: string, locale: "he" | "en"): string {
  return STATUS_MESSAGES[locale][status](orderNumber, customerName);
}
