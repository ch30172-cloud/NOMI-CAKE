import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normalizes an Israeli (or already-international) phone number to E.164.
 * Accepts: 050-1234567, 0501234567, +972501234567, 972501234567, 03-1234567.
 * Returns null when the number is not a valid phone number.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim().replace(/[\s\-().]/g, "");
  if (!trimmed) return null;
  const withPlus = /^972\d{8,9}$/.test(trimmed) ? `+${trimmed}` : trimmed;
  const parsed = parsePhoneNumberFromString(withPlus, "IL");
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // E.164
}

/** Digits only, as required by wa.me links (no "+"). */
export function toWhatsAppDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}

/** Display form, e.g. 050-123-4567 for IL numbers. */
export function formatPhoneForDisplay(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === "IL" ? parsed.formatNational() : parsed.formatInternational();
}
