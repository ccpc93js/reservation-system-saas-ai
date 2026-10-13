import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
  createServiceClient: async () => db,
}));

vi.mock("@/lib/channels/channex-bookings", () => ({
  drainFeed: vi.fn().mockResolvedValue({ processed: 0, acked: 0, byAction: {}, errors: [] }),
}));

import { POST } from "./route";

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/channels/channex/feed", { method: "POST", headers });
}

describe("POST /api/channels/channex/feed", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("allows a manager with a single membership", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await POST(req());
    expect(res.status).toBe(200);
  });

  it("allows a manager who belongs to more than one org (not just their primary)", async () => {
    db.seed("memberships", [
      { user_id: "user-1", organization_id: "org-1", role: "staff", created_at: "2026-01-01" },
      { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
    ]);
    const res = await POST(req());
    expect(res.status).toBe(200);
  });

  it("returns 403 for a staff-only user", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await POST(req());
    expect(res.status).toBe(403);
  });
});
