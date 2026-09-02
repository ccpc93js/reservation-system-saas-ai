// src/lib/plan.test.ts
import { describe, it, expect } from "vitest";
import {
  getPlanLimits,
  hasFeature,
  canAddGuestBookEntry,
  canAddBed,
  canAddUser,
  getBedLimit,
  getUserLimit,
} from "./plan";

describe("getPlanLimits", () => {
  it("returns the matching plan's limits", () => {
    expect(getPlanLimits("pro").beds).toBe(60);
  });

  it("falls back to free for an unknown plan string", () => {
    expect(getPlanLimits("nonsense")).toEqual(getPlanLimits("free"));
  });
});

describe("hasFeature", () => {
  it("free plan has no channels feature", () => {
    expect(hasFeature("free", "channels")).toBe(false);
  });

  it("pro plan has the channels feature", () => {
    expect(hasFeature("pro", "channels")).toBe(true);
  });
});

describe("canAddGuestBookEntry", () => {
  it("blocks once the free plan's guest book limit is reached", () => {
    expect(canAddGuestBookEntry("free", 500)).toBe(false);
    expect(canAddGuestBookEntry("free", 499)).toBe(true);
  });

  it("scale plan is unlimited (-1)", () => {
    expect(canAddGuestBookEntry("scale", 1_000_000)).toBe(true);
  });
});

describe("canAddBed / canAddUser", () => {
  it("blocks adding a bed at the free plan's limit", () => {
    expect(canAddBed("free", 20)).toBe(false);
    expect(canAddBed("free", 19)).toBe(true);
  });

  it("blocks adding a user at the free plan's limit", () => {
    expect(canAddUser("free", 1)).toBe(false);
  });

  it("allows adding a user below the free plan's limit", () => {
    expect(canAddUser("free", 0)).toBe(true);
  });

  it("scale plan allows unlimited beds and users", () => {
    expect(canAddBed("scale", 999)).toBe(true);
    expect(canAddUser("scale", 999)).toBe(true);
  });
});

describe("getBedLimit / getUserLimit", () => {
  it("reports -1 as unlimited for scale", () => {
    expect(getBedLimit("scale")).toBe(-1);
    expect(getUserLimit("scale")).toBe(-1);
  });

  it("reports finite limits for pro", () => {
    expect(getBedLimit("pro")).toBe(60);
    expect(getUserLimit("pro")).toBe(3);
  });
});
