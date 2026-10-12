import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
}));
vi.mock("@/lib/channels/channex-provision", () => ({
  provisionOrg: vi.fn().mockResolvedValue({ ok: true, rows: [], warnings: [], propertyId: "prop-1" }),
}));
vi.mock("@/lib/channels/channex-outbox", () => ({
  enqueueRestrictions: vi.fn().mockResolvedValue(undefined),
}));

import { PATCH, DELETE } from "./route";

function params(rateplanId = "rp-1") {
  return { params: Promise.resolve({ id: "rt-1", rateplanId }) };
}
function patchRequest(body: unknown) {
  return new Request("http://localhost/api/room-types/rt-1/rate-plans/rp-1", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/room-types/[id]/rate-plans/[rateplanId]", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
  });

  it("updates only the fields sent", async () => {
    db.seed("rate_plans", [{ id: "rp-1", organization_id: "org-1", room_type_id: "rt-1", name: "BAR", base_price: 100, is_default: false }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    const res = await PATCH(patchRequest({ base_price: 150 }), params());

    expect(res.status).toBe(200);
    expect(db.tables.rate_plans[0]).toMatchObject({ base_price: 150, name: "BAR" });
  });

  it("enqueues a sparse restrictions push naming only the touched field", async () => {
    const { enqueueRestrictions } = await import("@/lib/channels/channex-outbox");
    db.seed("rate_plans", [{ id: "rp-1", organization_id: "org-1", room_type_id: "rt-1", name: "BAR", base_price: 100, is_default: false }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    await PATCH(patchRequest({ base_price: 150 }), params());

    // base_price (the request/DB field name) maps to "rate" (the
    // OverrideFieldKey/Channex field name) — editing just the price must not
    // also claim every other restriction field was touched.
    expect(enqueueRestrictions).toHaveBeenCalledWith(db, "org-1", expect.any(String), expect.any(String), ["rp-1"], ["rate"]);
  });

  it("names every field actually touched when more than one changes", async () => {
    const { enqueueRestrictions } = await import("@/lib/channels/channex-outbox");
    db.seed("rate_plans", [{ id: "rp-1", organization_id: "org-1", room_type_id: "rt-1", name: "BAR", base_price: 100, is_default: false }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    await PATCH(patchRequest({ base_price: 150, stop_sell: true, name: "Best Available Rate" }), params());

    const call = vi.mocked(enqueueRestrictions).mock.calls.at(-1)!;
    expect(call[0]).toBe(db);
    expect(call[1]).toBe("org-1");
    expect(call[4]).toEqual(["rp-1"]);
    expect(new Set(call[5])).toEqual(new Set(["rate", "stop_sell"]));
  });

  it("does not enqueue a push when only the name changes", async () => {
    const { enqueueRestrictions } = await import("@/lib/channels/channex-outbox");
    vi.mocked(enqueueRestrictions).mockClear();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: "org-1", room_type_id: "rt-1", name: "BAR", base_price: 100, is_default: false }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    await PATCH(patchRequest({ name: "Best Available Rate" }), params());

    expect(enqueueRestrictions).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/room-types/[id]/rate-plans/[rateplanId]", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
  });

  function del(rateplanId = "rp-1") {
    return DELETE(new Request("http://localhost", { method: "DELETE" }), params(rateplanId));
  }

  it("deletes a non-default rate plan with no overrides", async () => {
    db.seed("rate_plans", [
      { id: "rp-default", organization_id: "org-1", room_type_id: "rt-1", name: "Standard Rate", is_default: true },
      { id: "rp-1", organization_id: "org-1", room_type_id: "rt-1", name: "BAR", is_default: false },
    ]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    const res = await del();

    expect(res.status).toBe(200);
    expect(db.tables.rate_plans.find((r: any) => r.id === "rp-1")).toBeUndefined();
  });

  it("refuses to delete the default rate plan", async () => {
    db.seed("rate_plans", [
      { id: "rp-default", organization_id: "org-1", room_type_id: "rt-1", name: "Standard Rate", is_default: true },
    ]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    const res = await del("rp-default");

    expect(res.status).toBe(409);
    expect(db.tables.rate_plans).toHaveLength(1);
  });

  it("refuses to delete a rate plan that has existing overrides", async () => {
    db.seed("rate_plans", [
      { id: "rp-default", organization_id: "org-1", room_type_id: "rt-1", name: "Standard Rate", is_default: true },
      { id: "rp-1", organization_id: "org-1", room_type_id: "rt-1", name: "BAR", is_default: false },
    ]);
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: "org-1", rate_plan_id: "rp-1", date: "2026-11-01", rate: 100 },
    ]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    const res = await del();

    expect(res.status).toBe(409);
    expect(db.tables.rate_plans.find((r: any) => r.id === "rp-1")).toBeDefined();
  });
});
