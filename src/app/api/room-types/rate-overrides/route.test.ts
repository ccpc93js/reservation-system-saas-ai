import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
let currentUser: { id: string } | null = { id: "user-1" };

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => {
    (db as any).auth = {
      getUser: async () => ({ data: { user: currentUser }, error: currentUser ? null : { message: "no user" } }),
    };
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
    currentUser = { id: "user-1" };
    vi.mocked(applyRateOverrides).mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    currentUser = null;
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a staff member", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await POST(jsonRequest({ room_type_ids: ["rt-1"], date_from: "2026-11-01", date_to: "2026-11-01", rate: 100 }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when the payload fails validation", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await POST(jsonRequest({ room_type_ids: [], date_from: "2026-11-01", date_to: "2026-11-01", rate: 100 }));
    expect(res.status).toBe(400);
    expect(applyRateOverrides).not.toHaveBeenCalled();
  });

  it("calls applyRateOverrides with only the touched fields for a manager", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    vi.mocked(applyRateOverrides).mockResolvedValue({ ok: true, rowsWritten: 2, skippedRoomTypeIds: [] });

    const res = await POST(jsonRequest({ room_type_ids: ["rt-1"], date_from: "2026-11-01", date_to: "2026-11-02", rate: 333 }));

    expect(res.status).toBe(200);
    expect(applyRateOverrides).toHaveBeenCalledWith(expect.anything(), "org-1", {
      roomTypeIds: ["rt-1"],
      dateFrom: "2026-11-01",
      dateTo: "2026-11-02",
      fields: { rate: 333 },
    });
  });
});

describe("GET /api/room-types/rate-overrides", () => {
  beforeEach(() => {
    db.tables = {};
    currentUser = { id: "user-1" };
  });

  it("returns 400 without from/to", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await GET(new Request("http://localhost/api/room-types/rate-overrides"));
    expect(res.status).toBe(400);
  });

  it("is readable by staff (read-only, not manager-gated)", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    db.seed("room_type_rate_overrides", [{ id: "ov-1", organization_id: "org-1", date: "2026-11-01" }]);
    const res = await GET(new Request("http://localhost/api/room-types/rate-overrides?from=2026-11-01&to=2026-11-30"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.overrides).toHaveLength(1);
  });
});
