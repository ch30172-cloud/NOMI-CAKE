/**
 * Time-slot generation for the checkout. Pure and tested (tests/slots.test.ts).
 * Times are "HH:MM" strings in the business timezone (Asia/Jerusalem).
 */
export interface BlockedSlot {
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  kind: "pickup" | "delivery" | null;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function generateSlots(params: {
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  blocked: BlockedSlot[];
  kind: "pickup" | "delivery";
}): string[] {
  const open = toMinutes(params.openTime);
  const close = toMinutes(params.closeTime);
  const slots: string[] = [];
  for (let t = open; t <= close; t += params.slotMinutes) {
    const isBlocked = params.blocked.some(
      (b) => (b.kind === null || b.kind === params.kind) && t >= toMinutes(b.start_time) && t < toMinutes(b.end_time)
    );
    if (!isBlocked) slots.push(toTime(t));
  }
  return slots;
}

/** YYYY-MM-DD for a Date in the given IANA timezone. */
export function dateKeyInTz(date: Date, timeZone = "Asia/Jerusalem"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
