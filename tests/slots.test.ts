import { describe, expect, it } from "vitest";
import { addDays, dateKeyInTz, generateSlots, toMinutes, toTime } from "@/lib/availability/slots";

describe("slots", () => {
  it("converts times", () => {
    expect(toMinutes("10:30")).toBe(630);
    expect(toMinutes("10:30:00")).toBe(630);
    expect(toTime(630)).toBe("10:30");
  });

  it("generates aligned slots inside working hours", () => {
    expect(generateSlots({ openTime: "10:00", closeTime: "12:00", slotMinutes: 60, blocked: [], kind: "pickup" })).toEqual(["10:00", "11:00", "12:00"]);
    expect(generateSlots({ openTime: "10:00:00", closeTime: "11:00:00", slotMinutes: 30, blocked: [], kind: "pickup" })).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("removes blocked slots, respecting kind", () => {
    const blocked = [
      { start_time: "11:00", end_time: "12:00", kind: null },
      { start_time: "13:00", end_time: "14:00", kind: "delivery" as const },
    ];
    expect(generateSlots({ openTime: "10:00", closeTime: "14:00", slotMinutes: 60, blocked, kind: "pickup" })).toEqual(["10:00", "12:00", "13:00", "14:00"]);
    expect(generateSlots({ openTime: "10:00", closeTime: "14:00", slotMinutes: 60, blocked, kind: "delivery" })).toEqual(["10:00", "12:00", "14:00"]);
  });

  it("date helpers work in Asia/Jerusalem", () => {
    // 2026-03-01T23:30Z is already March 2nd in Israel (UTC+2).
    expect(dateKeyInTz(new Date("2026-03-01T23:30:00Z"))).toBe("2026-03-02");
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
