import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
  createServiceClient: async () => db,
}));

vi.mock("@/lib/channels/channex-mods", () => ({
  listPendingMods: vi.fn(async (_supabase: any, orgId: string) => [{ id: `mod-for-${orgId}` }]),
  applyModification: vi.fn(async () => ({ ok: true })),
  dismissModification: vi.fn(async () => ({ ok: true })),
}));

import { GET, POST } from "./route";
import { listPendingMods } from "@/lib/channels/channex-mods";

function getReq(orgId?: string) {
  const url = orgId
    ? `http://localhost/api/channels/channex/modifications?orgId=${orgId}`
    : "http://localhost/api/channels/channex/modifications";
  return new Request(url);
}
function postReq(body: unknown) {
  return new Request("http://localhost/api/channels/channex/modifications", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("GET /api/channels/channex/modifications", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await GET(getReq("org-1"));
    expect(res.status).toBe(401);
  });

  it("lists mods for the org explicitly requested, not the caller's primary membership", async () => {
    db.seed("memberships", [
      { user_id: "user-1", organization_id: "org-1", role: "manager", created_at: "2026-01-01" },
      { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
    ]);
    const res = await GET(getReq("org-2"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(listPendingMods).toHaveBeenCalledWith(expect.anything(), "org-2");
    expect(data.mods).toEqual([{ id: "mod-for-org-2" }]);
  });

  it("returns 403 for a user with no membership in the requested org", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await GET(getReq("org-2"));
    expect(res.status).toBe(403);
  });

  it("returns 400 when orgId is missing", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await GET(getReq());
    expect(res.status).toBe(400);
  });
});

describe("POST /api/channels/channex/modifications", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    vi.clearAllMocks();
  });

  it("resolves a mod for a non-primary org when the caller is a manager there", async () => {
    db.seed("memberships", [
      { user_id: "user-1", organization_id: "org-1", role: "manager", created_at: "2026-01-01" },
      { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
    ]);
    const res = await POST(postReq({ orgId: "org-2", modId: "mod-1", action: "apply" }));
    expect(res.status).toBe(200);
  });

  it("returns 403 for a staff-only member", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await POST(postReq({ orgId: "org-1", modId: "mod-1", action: "apply" }));
    expect(res.status).toBe(403);
  });
});
