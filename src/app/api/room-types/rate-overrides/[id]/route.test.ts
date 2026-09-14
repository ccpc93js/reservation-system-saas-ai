import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
}));

vi.mock("@/lib/rate-overrides", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-overrides")>();
  return { ...actual, clearRateOverrideField: vi.fn() };
});

import { clearRateOverrideField } from "@/lib/rate-overrides";
import { PATCH } from "./route";

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/room-types/rate-overrides/ov-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/room-types/rate-overrides/[id]", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    vi.mocked(clearRateOverrideField).mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await PATCH(patchRequest({ field: "rate" }), { params: Promise.resolve({ id: "ov-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a staff member", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await PATCH(patchRequest({ field: "rate" }), { params: Promise.resolve({ id: "ov-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid field name", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await PATCH(patchRequest({ field: "not_a_real_field" }), { params: Promise.resolve({ id: "ov-1" }) });
    expect(res.status).toBe(400);
    expect(clearRateOverrideField).not.toHaveBeenCalled();
  });

  it("clears the field for a manager", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    vi.mocked(clearRateOverrideField).mockResolvedValue({ ok: true });

    const res = await PATCH(patchRequest({ field: "rate" }), { params: Promise.resolve({ id: "ov-1" }) });

    expect(res.status).toBe(200);
    expect(clearRateOverrideField).toHaveBeenCalledWith(expect.anything(), "org-1", "ov-1", "rate");
  });
});
