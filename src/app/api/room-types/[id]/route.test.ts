import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
}));

import { GET, PATCH, DELETE } from "./route";

function params(id = "rt-1") {
  return { params: Promise.resolve({ id }) };
}
function patchRequest(body: unknown) {
  return new Request("http://localhost/api/room-types/rt-1", { method: "PATCH", body: JSON.stringify(body) });
}

describe("room-types/[id] route", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    db.seed("room_types", [{ id: "rt-1", organization_id: "org-1", name: "Twin Room", type: "private", capacity: 2, base_price: 100 }]);
  });

  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      db.setUser(null);
      const res = await GET(new Request("http://localhost"), params());
      expect(res.status).toBe(401);
    });

    it("includes the room type's rate plans", async () => {
      db.seed("rate_plans", [
        { id: "rp-1", room_type_id: "rt-1", name: "Standard Rate", base_price: 100, is_default: true },
        { id: "rp-2", room_type_id: "rt-1", name: "Bed & Breakfast", base_price: 120, is_default: false },
      ]);

      const res = await GET(new Request("http://localhost"), params());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.rate_plans).toHaveLength(2);
      expect(data.rate_plans.map((rp: any) => rp.name).sort()).toEqual(["Bed & Breakfast", "Standard Rate"]);
    });

    it("returns 404 for a room type belonging to another org", async () => {
      db.seed("room_types", [{ id: "rt-2", organization_id: "other-org", name: "X", type: "private", capacity: 1, base_price: 50 }]);
      const res = await GET(new Request("http://localhost"), params("rt-2"));
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH", () => {
    it("updates physical attributes", async () => {
      const res = await PATCH(patchRequest({ name: "Deluxe Twin" }), params());
      expect(res.status).toBe(200);
      expect(db.tables.room_types[0]).toMatchObject({ name: "Deluxe Twin" });
    });

    it("silently drops pricing/restriction fields instead of writing them", async () => {
      const res = await PATCH(patchRequest({ name: "Deluxe Twin", base_price: 999, stop_sell: true }), params());
      expect(res.status).toBe(200);
      expect(db.tables.room_types[0]).toMatchObject({ name: "Deluxe Twin", base_price: 100 });
      expect(db.tables.room_types[0]).not.toHaveProperty("stop_sell");
    });

    it("returns 404 for a room type belonging to another org", async () => {
      db.seed("room_types", [{ id: "rt-2", organization_id: "other-org", name: "X", type: "private", capacity: 1, base_price: 50 }]);
      const res = await PATCH(patchRequest({ name: "Y" }), params("rt-2"));
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("blocks deletion when rooms exist", async () => {
      db.seed("rooms", [{ id: "room-1", room_type_id: "rt-1", organization_id: "org-1" }]);
      const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), params());
      expect(res.status).toBe(409);
      expect(db.tables.room_types).toHaveLength(1);
    });

    it("deletes a room type with no rooms", async () => {
      const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), params());
      expect(res.status).toBe(200);
      expect(db.tables.room_types).toHaveLength(0);
    });
  });
});
