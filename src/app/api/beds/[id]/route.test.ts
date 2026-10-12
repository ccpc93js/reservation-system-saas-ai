import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
}));

import { GET, PATCH, DELETE } from "./route";

function params(id = "bed-1") {
  return { params: Promise.resolve({ id }) };
}
function patchRequest(body: unknown) {
  return new Request("http://localhost/api/beds/bed-1", { method: "PATCH", body: JSON.stringify(body) });
}

describe("beds/[id] route", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    db.seed("beds", [{ id: "bed-1", organization_id: "org-1", room_id: "room-1", name: "Bed 1" }]);
  });

  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      db.setUser(null);
      const res = await GET(new Request("http://localhost"), params());
      expect(res.status).toBe(401);
    });

    it("returns 404 for a bed belonging to another org", async () => {
      db.seed("beds", [{ id: "bed-2", organization_id: "other-org", room_id: "room-1", name: "X" }]);
      const res = await GET(new Request("http://localhost"), params("bed-2"));
      expect(res.status).toBe(404);
    });

    it("succeeds when the bed's org is a non-primary membership", async () => {
      db.seed("beds", [{ id: "bed-2", organization_id: "org-2", room_id: "room-1", name: "Bed 2" }]);
      db.seed("memberships", [
        { user_id: "user-1", organization_id: "org-1", role: "manager", created_at: "2026-01-01" },
        { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
      ]);
      const res = await GET(new Request("http://localhost"), params("bed-2"));
      expect(res.status).toBe(200);
    });
  });

  describe("PATCH", () => {
    it("updates a bed belonging to the caller's org", async () => {
      const res = await PATCH(patchRequest({ name: "Bed 1A" }), params());
      expect(res.status).toBe(200);
      expect(db.tables.beds[0]).toMatchObject({ name: "Bed 1A" });
    });

    it("returns 404 for a bed belonging to another org", async () => {
      db.seed("beds", [{ id: "bed-2", organization_id: "other-org", room_id: "room-1", name: "X" }]);
      const res = await PATCH(patchRequest({ name: "Y" }), params("bed-2"));
      expect(res.status).toBe(404);
    });

    it("succeeds when the bed's org is a non-primary membership", async () => {
      db.seed("beds", [{ id: "bed-2", organization_id: "org-2", room_id: "room-1", name: "Bed 2" }]);
      db.seed("memberships", [
        { user_id: "user-1", organization_id: "org-1", role: "manager", created_at: "2026-01-01" },
        { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
      ]);
      const res = await PATCH(patchRequest({ name: "Bed 2A" }), params("bed-2"));
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE", () => {
    it("deletes a bed with no reservation items", async () => {
      const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), params());
      expect(res.status).toBe(200);
      expect(db.tables.beds).toHaveLength(0);
    });

    it("blocks deletion when reservation items exist", async () => {
      db.seed("reservation_items", [{ id: "ri-1", bed_id: "bed-1" }]);
      const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), params());
      expect(res.status).toBe(409);
      expect(db.tables.beds).toHaveLength(1);
    });

    it("succeeds when the bed's org is a non-primary membership", async () => {
      db.seed("beds", [{ id: "bed-2", organization_id: "org-2", room_id: "room-1", name: "Bed 2" }]);
      db.seed("memberships", [
        { user_id: "user-1", organization_id: "org-1", role: "manager", created_at: "2026-01-01" },
        { user_id: "user-1", organization_id: "org-2", role: "manager", created_at: "2026-02-01" },
      ]);
      const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), params("bed-2"));
      expect(res.status).toBe(200);
    });
  });
});
