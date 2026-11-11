/** Formatting helpers for integer agorot amounts. */

export function agorotToIls(agorot: number): number {
  return agorot / 100;
}

export function ilsToAgorot(ils: number | string): number {
  const n = typeof ils === "string" ? Number(ils.replace(",", ".")) : ils;
  if (!Number.isFinite(n)) throw new Error("invalid_amount");
  return Math.round(n * 100);
}

export function formatMoney(agorot: number, locale: string = "he"): string {
  return new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: agorot % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(agorotToIls(agorot));
}
