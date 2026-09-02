// src/lib/permissions.test.ts
import { describe, it, expect } from "vitest";
import {
  canAccessSection,
  isManager,
  isOwner,
  roleRank,
  canManageMember,
  assignableRoles,
} from "./permissions";

describe("canAccessSection", () => {
  it("allows any role into a section not listed in SECTION_ROLES", () => {
    expect(canAccessSection("staff", "reservations")).toBe(true);
    expect(canAccessSection(undefined, "reservations")).toBe(true);
  });

  it("blocks staff from a manager-only section", () => {
    expect(canAccessSection("staff", "channels")).toBe(false);
  });

  it("allows manager/owner into a manager-only section", () => {
    expect(canAccessSection("manager", "channels")).toBe(true);
    expect(canAccessSection("owner", "channels")).toBe(true);
  });

  it("restricts an owner-only section to owner", () => {
    expect(canAccessSection("manager", "settings/billing")).toBe(false);
    expect(canAccessSection("owner", "settings/billing")).toBe(true);
  });
});

describe("isManager / isOwner", () => {
  it("treats admin as a manager", () => {
    expect(isManager("admin")).toBe(true);
  });

  it("does not treat staff as a manager", () => {
    expect(isManager("staff")).toBe(false);
  });

  it("only owner is owner", () => {
    expect(isOwner("owner")).toBe(true);
    expect(isOwner("manager")).toBe(false);
  });
});

describe("roleRank / canManageMember", () => {
  it("ranks owner above manager/admin above staff", () => {
    expect(roleRank("owner")).toBeGreaterThan(roleRank("manager"));
    expect(roleRank("manager")).toBeGreaterThan(roleRank("staff"));
  });

  it("gives an unknown/undefined role rank 0", () => {
    expect(roleRank(undefined)).toBe(0);
    expect(roleRank("bogus")).toBe(0);
  });

  it("owner can manage manager and staff", () => {
    expect(canManageMember("owner", "manager")).toBe(true);
    expect(canManageMember("owner", "staff")).toBe(true);
  });

  it("manager cannot manage another manager or an owner", () => {
    expect(canManageMember("manager", "manager")).toBe(false);
    expect(canManageMember("manager", "owner")).toBe(false);
  });

  it("manager can manage staff", () => {
    expect(canManageMember("manager", "staff")).toBe(true);
  });
});

describe("assignableRoles", () => {
  it("only an owner can assign the owner role", () => {
    expect(assignableRoles("owner")).toContain("owner");
    expect(assignableRoles("manager")).not.toContain("owner");
  });

  it("manager can assign manager and staff", () => {
    expect(assignableRoles("manager")).toEqual(expect.arrayContaining(["manager", "staff"]));
  });

  it("staff can assign the staff role but nothing higher", () => {
    expect(assignableRoles("staff")).toEqual(["staff"]);
  });
});
