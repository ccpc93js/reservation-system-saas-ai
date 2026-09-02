import { describe, it, expect } from "vitest";
import { cn, formatCurrency, formatDate, getNights, STATUS_LABELS, CHANNEL_LABELS } from "./utils";

describe("cn", () => {
  it("merges class names and dedupes conflicting Tailwind utilities", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, "b")).toBe("a b");
  });
});

describe("formatCurrency", () => {
  it("formats EUR by default with 2 decimals", () => {
    // es-ES grouping only kicks in at 5+ digits under current ICU data, so
    // 1234.5 renders as "1234,50" (no thousands separator) — assert the
    // comma-decimal formatting this test actually cares about, not grouping.
    expect(formatCurrency(1234.5)).toContain("1234,50");
  });

  it("groups thousands with a period for larger amounts", () => {
    expect(formatCurrency(12345.5)).toContain("12.345,50");
  });

  it("formats a different currency when given", () => {
    const result = formatCurrency(10, "USD");
    expect(result).toMatch(/US\$|USD/);
  });
});

describe("formatDate", () => {
  it("formats a date string as 'DD Mon YYYY'", () => {
    expect(formatDate("2026-06-15")).toBe("15 Jun 2026");
  });

  it("accepts a Date object", () => {
    expect(formatDate(new Date("2026-01-01T00:00:00Z"))).toBe("01 Jan 2026");
  });
});

describe("getNights", () => {
  it("computes whole nights between two dates", () => {
    expect(getNights("2026-06-15", "2026-06-18")).toBe(3);
  });

  it("returns 0 for same-day check-in/check-out", () => {
    expect(getNights("2026-06-15", "2026-06-15")).toBe(0);
  });
});

describe("label maps", () => {
  it("STATUS_LABELS covers every reservation status", () => {
    for (const s of ["pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"]) {
      expect(STATUS_LABELS[s]).toBeTruthy();
    }
  });

  it("CHANNEL_LABELS covers every known channel", () => {
    for (const c of ["walk_in", "phone", "email", "booking_com", "airbnb", "hostelworld", "direct_website", "other"]) {
      expect(CHANNEL_LABELS[c]).toBeTruthy();
    }
  });
});
