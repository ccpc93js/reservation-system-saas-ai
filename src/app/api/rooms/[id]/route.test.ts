import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
}));

import { GET, PATCH, DELETE } from "./route";

function params(id = "room-1") {
  return { params: Promise.resolve({ id }) };
}
function patchRequest(body: unknown) {
  return new Request("http://localhost/api/rooms/room-1", { method: "PATCH", body: JSON.stringify(body) });
}

describe("rooms/[id] route", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    db.seed("rooms", [{ id: "room-1", organization_id: "org-1", name: "Twin 1", room_type_id: "rt-1" }]);
  });

  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      db.setUser(null);
      const res = await GET(new Request("http://localhost"), params());
      expect(res.status).toBe(401);
    });

    it("returns 404 for a room belonging to another org", async () => {
      db.seed("rooms", [{ id: "room-2", organization_id: "other-org", name: "X", room_type_id: "rt-1" }]);
      const res = await GET(new Request("http://localhost"), params("room-2"));
      expect(res.status).toBe(404);
    });

    it("succeeds when the room's org is a non-primary membership", async () => {
      db.seed("rooms", [{ id: "room-2", organization_id: "org-2", name: "Twin 2", room_type_id: "rt-1" }]);
      db.seed("memberships", [
        { user_id: "user-1", organization_id: "org-1", role: "manager", created_at: "2026-01-01" },
        { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
      ]);
      const res = await GET(new Request("http://localhost"), params("room-2"));
      expect(res.status).toBe(200);
    });
  });

  describe("PATCH", () => {
    it("updates a room belonging to the caller's org", async () => {
      const res = await PATCH(patchRequest({ name: "Deluxe Twin" }), params());
      expect(res.status).toBe(200);
      expect(db.tables.rooms[0]).toMatchObject({ name: "Deluxe Twin" });
    });

    it("returns 404 for a room belonging to another org", async () => {
      db.seed("rooms", [{ id: "room-2", organization_id: "other-org", name: "X", room_type_id: "rt-1" }]);
      const res = await PATCH(patchRequest({ name: "Y" }), params("room-2"));
      expect(res.status).toBe(404);
    });

    it("succeeds when the room's org is a non-primary membership", async () => {
      db.seed("rooms", [{ id: "room-2", organization_id: "org-2", name: "Twin 2", room_type_id: "rt-1" }]);
      db.seed("memberships", [
        { user_id: "user-1", organization_id: "org-1", role: "manager", created_at: "2026-01-01" },
        { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
      ]);
      const res = await PATCH(patchRequest({ name: "Deluxe Twin" }), params("room-2"));
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE", () => {
    it("deletes a room with no beds", async () => {
      const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), params());
      expect(res.status).toBe(200);
      expect(db.tables.rooms).toHaveLength(0);
    });

    it("blocks deletion when beds exist", async () => {
      db.seed("beds", [{ id: "bed-1", room_id: "room-1", organization_id: "org-1" }]);
      const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), params());
      expect(res.status).toBe(409);
      expect(db.tables.rooms).toHaveLength(1);
    });

    it("succeeds when the room's org is a non-primary membership", async () => {
      db.seed("rooms", [{ id: "room-2", organization_id: "org-2", name: "Twin 2", room_type_id: "rt-1" }]);
      db.seed("memberships", [
        { user_id: "user-1", organization_id: "org-1", role: "manager", created_at: "2026-01-01" },
        { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
      ]);
      const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), params("room-2"));
      expect(res.status).toBe(200);
    });
  });
});
