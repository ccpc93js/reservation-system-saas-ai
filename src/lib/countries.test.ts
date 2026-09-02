import { describe, it, expect } from "vitest";
import { COUNTRIES } from "./countries";

describe("COUNTRIES", () => {
  it("is a non-empty array of unique strings", () => {
    expect(COUNTRIES.length).toBeGreaterThan(100);
    expect(new Set(COUNTRIES).size).toBe(COUNTRIES.length);
  });

  it("is sorted alphabetically", () => {
    const sorted = [...COUNTRIES].sort();
    expect(COUNTRIES).toEqual(sorted);
  });

  it("contains expected common countries", () => {
    for (const c of ["United States", "United Kingdom", "Germany", "Serbia"]) {
      expect(COUNTRIES).toContain(c);
    }
  });
});
