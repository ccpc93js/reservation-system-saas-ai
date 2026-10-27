import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => {
    return db;
  },
}));

vi.mock("@/lib/rate-overrides", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-overrides")>();
  return { ...actual, applyRateOverrides: vi.fn() };
});

import { applyRateOverrides } from "@/lib/rate-overrides";
import { GET, POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/room-types/rate-overrides", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/room-types/rate-overrides", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    vi.mocked(applyRateOverrides).mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a staff member", async () => {
    db.seed("rate_plans", [{ id: "rp-1", organization_id: "org-1" }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await POST(jsonRequest({ rate_plan_ids: ["rp-1"], date_from: "2026-11-01", date_to: "2026-11-01", rate: 100 }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when the payload fails validation", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await POST(jsonRequest({ rate_plan_ids: [], date_from: "2026-11-01", date_to: "2026-11-01", rate: 100 }));
    expect(res.status).toBe(400);
    expect(applyRateOverrides).not.toHaveBeenCalled();
  });

  it("calls applyRateOverrides with only the touched fields for a manager", async () => {
    db.seed("rate_plans", [{ id: "rp-1", organization_id: "org-1" }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    vi.mocked(applyRateOverrides).mockResolvedValue({ ok: true, rowsWritten: 2, skippedRatePlanIds: [] });

    const res = await POST(jsonRequest({ rate_plan_ids: ["rp-1"], date_from: "2026-11-01", date_to: "2026-11-02", rate: 333 }));

    expect(res.status).toBe(200);
    expect(applyRateOverrides).toHaveBeenCalledWith(expect.anything(), "org-1", {
      ratePlanIds: ["rp-1"],
      dateFrom: "2026-11-01",
      dateTo: "2026-11-02",
      fields: { rate: 333 },
    });
  });

  it("succeeds when the anchor rate plan's org is a non-primary membership", async () => {
    db.seed("rate_plans", [{ id: "rp-1", organization_id: "org-2" }]);
    db.seed("memberships", [
      { user_id: "user-1", organization_id: "org-1", role: "manager", created_at: "2026-01-01" },
      { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
    ]);
    vi.mocked(applyRateOverrides).mockResolvedValue({ ok: true, rowsWritten: 1, skippedRatePlanIds: [] });

    const res = await POST(jsonRequest({ rate_plan_ids: ["rp-1"], date_from: "2026-11-01", date_to: "2026-11-02", rate: 333 }));

    expect(res.status).toBe(200);
    expect(applyRateOverrides).toHaveBeenCalledWith(expect.anything(), "org-2", expect.objectContaining({ ratePlanIds: ["rp-1"] }));
  });
});

describe("GET /api/room-types/rate-overrides", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
  });

  it("returns 400 without from/to", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await GET(new Request("http://localhost/api/room-types/rate-overrides?org_id=org-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 without org_id", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await GET(new Request("http://localhost/api/room-types/rate-overrides?from=2026-11-01&to=2026-11-30"));
    expect(res.status).toBe(400);
  });

  it("returns 403 for an org the caller isn't a member of", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await GET(new Request("http://localhost/api/room-types/rate-overrides?from=2026-11-01&to=2026-11-30&org_id=org-2"));
    expect(res.status).toBe(403);
  });

  it("is readable by staff (read-only, not manager-gated)", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    db.seed("room_type_rate_overrides", [{ id: "ov-1", organization_id: "org-1", date: "2026-11-01" }]);
    const res = await GET(new Request("http://localhost/api/room-types/rate-overrides?from=2026-11-01&to=2026-11-30&org_id=org-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.overrides).toHaveLength(1);
  });

  it("scopes to the requested org, not the caller's oldest membership", async () => {
    // Regression for the exact bug behind a false-negative "Upcoming
    // overrides" list in the UI: a caller whose oldest membership is org-1
    // but who is viewing org-2's Rates & Restrictions page must see org-2's
    // overrides, not org-1's (or nothing).
    db.seed("memberships", [
      { user_id: "user-1", organization_id: "org-1", role: "manager", created_at: "2026-01-01" },
      { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
    ]);
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: "org-1", date: "2026-11-05" },
      { id: "ov-2", organization_id: "org-2", date: "2026-11-05" },
    ]);
    const res = await GET(new Request("http://localhost/api/room-types/rate-overrides?from=2026-11-01&to=2026-11-10&org_id=org-2"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.overrides).toHaveLength(1);
    expect(data.overrides[0].id).toBe("ov-2");
  });
});
