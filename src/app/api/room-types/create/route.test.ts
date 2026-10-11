// src/app/api/room-types/create/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
}));

const db = new FakeSupabaseClient();

import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/room-types/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/room-types/create", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await POST(jsonRequest({ name: "Twin Room", type: "private", capacity: 2, base_price: 100 }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the user has no membership", async () => {
    db.tables.memberships = [];
    const res = await POST(jsonRequest({ name: "Twin Room", type: "private", capacity: 2, base_price: 100 }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when the payload fails validation", async () => {
    const res = await POST(jsonRequest({ name: "T", type: "private", capacity: 2, base_price: 100 }));
    expect(res.status).toBe(400);
  });

  it("creates the room type (physical attributes only) and a matching default rate plan", async () => {
    const res = await POST(jsonRequest({
      name: "Twin Room", type: "private", capacity: 2, base_price: 100,
      stop_sell: false, closed_to_arrival: true, min_stay_arrival: 2,
    }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(db.tables.room_types).toHaveLength(1);
    expect(db.tables.room_types[0]).toMatchObject({
      organization_id: "org-1", name: "Twin Room", type: "private", capacity: 2, base_price: 100,
    });

    expect(db.tables.rate_plans).toHaveLength(1);
    expect(db.tables.rate_plans[0]).toMatchObject({
      organization_id: "org-1",
      room_type_id: data.room_type_id,
      name: "Standard Rate",
      base_price: 100,
      stop_sell: false,
      closed_to_arrival: true,
      min_stay_arrival: 2,
      is_default: true,
    });
  });

  it("defaults unset restriction fields to false/null on both the room type and its rate plan", async () => {
    const res = await POST(jsonRequest({ name: "Twin Room", type: "private", capacity: 2, base_price: 100 }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(db.tables.rate_plans[0]).toMatchObject({
      room_type_id: data.room_type_id,
      stop_sell: false, closed_to_arrival: false, closed_to_departure: false,
      min_stay_arrival: null, min_stay_through: null, max_stay: null,
    });
  });

  it("still returns 201 with the room type if the default rate plan insert fails", async () => {
    db.forceError("rate_plans", "insert", "simulated failure");

    const res = await POST(jsonRequest({ name: "Twin Room", type: "private", capacity: 2, base_price: 100 }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.room_type_id).toBeDefined();
    expect(db.tables.room_types).toHaveLength(1);
    expect(db.tables.rate_plans ?? []).toHaveLength(0);
  });
});
