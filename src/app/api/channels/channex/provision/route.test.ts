import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
}));

vi.mock("@/lib/channels/channex-provision", () => ({
  provisionOrg: vi.fn(async (_supabase: any, orgId: string) => ({ ok: true, orgId, rows: [] })),
}));

import { POST } from "./route";
import { provisionOrg } from "@/lib/channels/channex-provision";

function req(body: unknown) {
  return new Request("http://localhost/api/channels/channex/provision", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/channels/channex/provision", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await POST(req({ orgId: "org-1" }));
    expect(res.status).toBe(401);
  });

  it("provisions the org the caller explicitly specified, not their primary membership", async () => {
    db.seed("memberships", [
      { user_id: "user-1", organization_id: "org-1", role: "manager", created_at: "2026-01-01" },
      { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
    ]);

    const res = await POST(req({ orgId: "org-2" }));
    expect(res.status).toBe(200);
    expect(provisionOrg).toHaveBeenCalledWith(expect.anything(), "org-2");
  });

  it("returns 403 for a user with no membership in the requested org", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await POST(req({ orgId: "org-2" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 for a staff-only member", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await POST(req({ orgId: "org-1" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when orgId is missing", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
