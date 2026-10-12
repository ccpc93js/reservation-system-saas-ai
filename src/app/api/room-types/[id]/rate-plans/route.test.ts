import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
}));

vi.mock("@/lib/channels/channex-provision", () => ({
  provisionOrg: vi.fn().mockResolvedValue({ ok: true, rows: [], warnings: [], propertyId: "prop-1" }),
}));

import { provisionOrg } from "@/lib/channels/channex-provision";
import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/room-types/rt-1/rate-plans", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
function params(id = "rt-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/room-types/[id]/rate-plans", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    vi.mocked(provisionOrg).mockClear();
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await POST(jsonRequest({ name: "BAR", base_price: 100 }), params());
    expect(res.status).toBe(401);
  });

  it("returns 403 for a staff member", async () => {
    db.seed("room_types", [{ id: "rt-1", organization_id: "org-1" }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await POST(jsonRequest({ name: "BAR", base_price: 100 }), params());
    expect(res.status).toBe(403);
  });

  it("returns 404 when the room type doesn't belong to the manager's org", async () => {
    db.seed("room_types", [{ id: "rt-1", organization_id: "other-org" }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await POST(jsonRequest({ name: "BAR", base_price: 100 }), params());
    expect(res.status).toBe(404);
  });

  it("succeeds when the room type's org is a non-primary membership", async () => {
    db.seed("room_types", [{ id: "rt-1", organization_id: "org-2" }]);
    db.seed("memberships", [
      { user_id: "user-1", organization_id: "org-1", role: "manager", created_at: "2026-01-01" },
      { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
    ]);
    const res = await POST(jsonRequest({ name: "BAR", base_price: 100 }), params());
    expect(res.status).toBe(201);
    expect(db.tables.rate_plans[0]).toMatchObject({ organization_id: "org-2" });
  });

  it("creates a non-default rate plan and provisions it", async () => {
    db.seed("room_types", [{ id: "rt-1", organization_id: "org-1" }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    const res = await POST(jsonRequest({ name: "Bed & Breakfast", base_price: 120 }), params());
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(db.tables.rate_plans).toHaveLength(1);
    expect(db.tables.rate_plans[0]).toMatchObject({
      room_type_id: "rt-1", organization_id: "org-1", name: "Bed & Breakfast", base_price: 120, is_default: false,
    });
    expect(data.rate_plan.id).toBe(db.tables.rate_plans[0].id);
    expect(provisionOrg).toHaveBeenCalledWith(db, "org-1");
  });

  it("still returns 201 with the created rate plan if provisioning throws", async () => {
    db.seed("room_types", [{ id: "rt-1", organization_id: "org-1" }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    vi.mocked(provisionOrg).mockRejectedValueOnce(new Error("Channex unreachable"));

    const res = await POST(jsonRequest({ name: "Bed & Breakfast", base_price: 120 }), params());
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.rate_plan).toMatchObject({ name: "Bed & Breakfast", base_price: 120 });
    expect(db.tables.rate_plans).toHaveLength(1);
  });

  it("still returns 201 if provisioning resolves but reports failure", async () => {
    db.seed("room_types", [{ id: "rt-1", organization_id: "org-1" }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    vi.mocked(provisionOrg).mockResolvedValueOnce({ ok: false, rows: [{ name: "Bed & Breakfast", kind: "rate_plan", action: "error", warning: "422" }], warnings: [], propertyId: "prop-1" });

    const res = await POST(jsonRequest({ name: "Bed & Breakfast", base_price: 120 }), params());

    expect(res.status).toBe(201);
    expect(db.tables.rate_plans).toHaveLength(1);
  });
});
