import { describe, it, expect } from "vitest";
import { toChannexMinor, unwrapOptions, type ChannexEntity } from "./channex";

describe("toChannexMinor", () => {
  it("converts a major-unit number to integer cents", () => {
    expect(toChannexMinor(80)).toBe(8000);
  });

  it("converts a major-unit string to integer cents", () => {
    expect(toChannexMinor("80.00")).toBe(8000);
  });

  it("rounds fractional cents", () => {
    expect(toChannexMinor(19.999)).toBe(2000);
  });

  it("handles zero", () => {
    expect(toChannexMinor(0)).toBe(0);
  });
});

describe("unwrapOptions", () => {
  it("flattens id + attributes into a single object per row", () => {
    const rows: ChannexEntity[] = [
      { id: "abc", attributes: { title: "Standard", currency: "EUR" } },
      { id: "def", attributes: { title: "Deluxe", currency: "USD" } },
    ];
    const result = unwrapOptions<{ id: string; title: string; currency: string }>(rows);
    expect(result).toEqual([
      { id: "abc", title: "Standard", currency: "EUR" },
      { id: "def", title: "Deluxe", currency: "USD" },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(unwrapOptions([])).toEqual([]);
  });

  it("handles a row with no attributes", () => {
    const rows: ChannexEntity[] = [{ id: "abc" }];
    expect(unwrapOptions(rows)).toEqual([{ id: "abc" }]);
  });
});
