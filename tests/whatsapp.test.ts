import { describe, expect, it } from "vitest";
import { buildOrderMessage, buildStatusMessage, buildWhatsAppLink } from "@/lib/whatsapp/message";
import { normalizePhone, toWhatsAppDigits } from "@/lib/whatsapp/phone";

describe("normalizePhone", () => {
  it("converts Israeli formats to E.164", () => {
    expect(normalizePhone("050-123-4567")).toBe("+972501234567");
    expect(normalizePhone("0501234567")).toBe("+972501234567");
    expect(normalizePhone("+972 50 123 4567")).toBe("+972501234567");
    expect(normalizePhone("972501234567")).toBe("+972501234567");
    expect(normalizePhone("03-6123456")).toBe("+97236123456");
  });
  it("rejects garbage", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
  it("strips the plus for wa.me", () => {
    expect(toWhatsAppDigits("+972501234567")).toBe("972501234567");
  });
});

describe("buildOrderMessage", () => {
  const order = {
    orderNumber: 1001,
    customerName: "דנה",
    customerPhone: "+972501234567",
    items: [
      { name: "עוגת שכבות", variant: "M", quantity: 1, lineTotalAgorot: 24000, notes: "בלי אגוזים" },
      { name: "עוגה מעוצבת", variant: null, quantity: 1, lineTotalAgorot: null },
    ],
    fulfillment: "delivery" as const,
    deliveryCityName: "תל אביב",
    deliveryAddress: "הרצל 1",
    scheduledDate: "2026-12-01",
    scheduledTime: "14:00",
    subtotalAgorot: 24000,
    discountAgorot: 2400,
    couponCode: "WELCOME10",
    deliveryFeeAgorot: 3000,
    totalAgorot: 24600,
    hasCustomPricing: true,
    notes: "להתקשר לפני",
  };

  it("includes every required field in Hebrew", () => {
    const msg = buildOrderMessage(order, "he");
    for (const s of ["#1001", "דנה", "+972501234567", "עוגת שכבות", "(M)", "בלי אגוזים", "מחיר בתיאום אישי", "משלוח", "הרצל 1, תל אביב", "2026-12-01", "14:00", "WELCOME10", "להתקשר לפני"]) {
      expect(msg).toContain(s);
    }
    expect(msg).toContain("סכום ידוע");
  });

  it("uses a plain total when nothing is custom priced", () => {
    const msg = buildOrderMessage({ ...order, hasCustomPricing: false, items: [order.items[0]] }, "en");
    expect(msg).toContain("Total:");
    expect(msg).not.toContain("Known amount");
  });

  it("builds a wa.me link with the encoded message", () => {
    const link = buildWhatsAppLink("+972501234567", "שלום עולם");
    expect(link.startsWith("https://wa.me/972501234567?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe("שלום עולם");
  });

  it("status messages mention the order number and name", () => {
    expect(buildStatusMessage("ready", 7, "Dana", "en")).toContain("#7");
    expect(buildStatusMessage("confirmed", 7, "דנה", "he")).toContain("דנה");
  });
});
