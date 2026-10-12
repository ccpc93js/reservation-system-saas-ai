import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
}));

import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/beds/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/beds/create", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await POST(jsonRequest({ room_id: "room-1", name: "Bed 1" }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when the room doesn't belong to any org the caller is a member of", async () => {
    db.seed("rooms", [{ id: "room-1", organization_id: "other-org" }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await POST(jsonRequest({ room_id: "room-1", name: "Bed 1" }));
    expect(res.status).toBe(404);
  });

  it("creates a bed for a room in the caller's org", async () => {
    db.seed("rooms", [{ id: "room-1", organization_id: "org-1" }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    db.seed("organizations", [{ id: "org-1", plan: "scale" }]);

    const res = await POST(jsonRequest({ room_id: "room-1", name: "Bed 1" }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(db.tables.beds).toHaveLength(1);
    expect(db.tables.beds[0]).toMatchObject({ organization_id: "org-1", room_id: "room-1", name: "Bed 1" });
    expect(data.bed_id).toBe(db.tables.beds[0].id);
  });

  it("succeeds when the room's org is a non-primary membership", async () => {
    db.seed("rooms", [{ id: "room-1", organization_id: "org-2" }]);
    db.seed("memberships", [
      { user_id: "user-1", organization_id: "org-1", role: "manager", created_at: "2026-01-01" },
      { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
    ]);
    db.seed("organizations", [{ id: "org-2", plan: "scale" }]);

    const res = await POST(jsonRequest({ room_id: "room-1", name: "Bed 1" }));

    expect(res.status).toBe(201);
    expect(db.tables.beds[0]).toMatchObject({ organization_id: "org-2" });
  });
});
