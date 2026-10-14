import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
  createServiceClient: async () => db,
}));

vi.mock("@/lib/channels/channex-availability", () => ({
  pushAvailabilityForOrg: vi.fn(async (_supabase: any, orgId: string) => ({
    ok: true,
    propertyId: "prop-1",
    roomTypesPushed: 1,
    entries: 1,
    channexTaskIds: [`avail-task-for-${orgId}`],
  })),
}));
vi.mock("@/lib/channels/channex-rates", () => ({
  pushRatesForOrg: vi.fn(async (_supabase: any, orgId: string) => ({
    ok: true,
    propertyId: "prop-1",
    ratePlansPushed: 1,
    entries: 1,
    channexTaskIds: [`rates-task-for-${orgId}`],
  })),
}));

import { POST } from "./route";
import { pushAvailabilityForOrg } from "@/lib/channels/channex-availability";

function req(body: unknown) {
  return new Request("http://localhost/api/channels/channex/push-availability", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/channels/channex/push-availability", () => {
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

  it("pushes to the org the caller explicitly specified, not their primary membership", async () => {
    // User's primary (oldest) membership is org-1, but they're viewing org-2's
    // Channel Manager page and click "Sync availability" there.
    db.seed("memberships", [
      { user_id: "user-1", organization_id: "org-1", role: "manager", created_at: "2026-01-01" },
      { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
    ]);

    const res = await POST(req({ orgId: "org-2" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(pushAvailabilityForOrg).toHaveBeenCalledWith(expect.anything(), "org-2", expect.anything());
    expect(data.results[0].orgId).toBe("org-2");
  });

  it("returns 403 for a user with no membership in the requested org", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await POST(req({ orgId: "org-2" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 for a staff-only member of the requested org", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await POST(req({ orgId: "org-1" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when orgId is missing from a non-cron request", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
