import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("./channels/channex-outbox", () => ({
  enqueueRestrictions: vi.fn().mockResolvedValue(undefined),
}));

import { enqueueRestrictions } from "./channels/channex-outbox";
import { applyRateOverrides, clearRateOverrideField } from "./rate-overrides";

const orgId = "org-1";

describe("applyRateOverrides", () => {
  it("writes one row per room type per date in range, touching only the given fields", async () => {
    const db = new FakeSupabaseClient();
    db.seed("room_types", [{ id: "rt-1", organization_id: orgId }]);

    const result = await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      roomTypeIds: ["rt-1"],
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      fields: { rate: 333 },
    });

    expect(result).toEqual({ ok: true, rowsWritten: 1, skippedRoomTypeIds: [] });
    expect(db.tables.room_type_rate_overrides).toHaveLength(1);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({
      room_type_id: "rt-1",
      date: "2026-11-21",
      rate: 333,
    });
    // Untouched fields aren't part of the upsert payload at all (partial
    // upsert), so a brand-new row simply doesn't carry the key — the real
    // DB column still defaults to NULL, this just isn't the fake's job to model.
    expect(db.tables.room_type_rate_overrides[0]).not.toHaveProperty("min_stay_arrival");
    expect(enqueueRestrictions).toHaveBeenCalledWith(db, orgId, "2026-11-21", "2026-11-22", ["rt-1"]);
  });

  it("preserves untouched fields on an existing row", async () => {
    const db = new FakeSupabaseClient();
    db.seed("room_types", [{ id: "rt-1", organization_id: orgId }]);
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: orgId, room_type_id: "rt-1", date: "2026-11-21", rate: 100, min_stay_arrival: 2, min_stay_through: null, max_stay: null, stop_sell: null, closed_to_arrival: null, closed_to_departure: null },
    ]);

    await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      roomTypeIds: ["rt-1"],
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      fields: { rate: 333 },
    });

    expect(db.tables.room_type_rate_overrides).toHaveLength(1);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({ rate: 333, min_stay_arrival: 2 });
  });

  it("expands a multi-date range into one row per date", async () => {
    const db = new FakeSupabaseClient();
    db.seed("room_types", [{ id: "rt-1", organization_id: orgId }]);

    await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      roomTypeIds: ["rt-1"],
      dateFrom: "2026-11-01",
      dateTo: "2026-11-03",
      fields: { stop_sell: true },
    });

    expect(db.tables.room_type_rate_overrides.map((r: any) => r.date).sort()).toEqual([
      "2026-11-01", "2026-11-02", "2026-11-03",
    ]);
  });

  it("rejects room types that don't belong to the org", async () => {
    const db = new FakeSupabaseClient();
    db.seed("room_types", [{ id: "rt-1", organization_id: "other-org" }]);

    const result = await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      roomTypeIds: ["rt-1"],
      dateFrom: "2026-11-01",
      dateTo: "2026-11-01",
      fields: { rate: 100 },
    });

    expect(result.ok).toBe(false);
    expect(result.skippedRoomTypeIds).toEqual(["rt-1"]);
    expect(db.tables.room_type_rate_overrides ?? []).toHaveLength(0);
  });

  it("skips room types that don't belong to the org but still writes the valid ones", async () => {
    const db = new FakeSupabaseClient();
    db.seed("room_types", [{ id: "rt-1", organization_id: orgId }]);

    const result = await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      roomTypeIds: ["rt-1", "rt-invalid"],
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      fields: { rate: 333 },
    });

    expect(result.ok).toBe(true);
    expect(result.skippedRoomTypeIds).toEqual(["rt-invalid"]);
    expect(db.tables.room_type_rate_overrides).toHaveLength(1);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({ room_type_id: "rt-1" });
    expect(
      db.tables.room_type_rate_overrides.some((r: any) => r.room_type_id === "rt-invalid")
    ).toBe(false);
  });
});

describe("clearRateOverrideField", () => {
  it("nulls just the given field and enqueues a push for that date", async () => {
    const db = new FakeSupabaseClient();
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: orgId, room_type_id: "rt-1", date: "2026-11-21", rate: 333, min_stay_arrival: 2, min_stay_through: null, max_stay: null, stop_sell: null, closed_to_arrival: null, closed_to_departure: null },
    ]);

    const result = await clearRateOverrideField(db as unknown as SupabaseClient, orgId, "ov-1", "rate");

    expect(result.ok).toBe(true);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({ rate: null, min_stay_arrival: 2 });
    expect(enqueueRestrictions).toHaveBeenCalledWith(db, orgId, "2026-11-21", "2026-11-22", ["rt-1"]);
  });
});
