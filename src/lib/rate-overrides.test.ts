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
  it("writes one row per rate plan per date in range, touching only the given fields", async () => {
    const db = new FakeSupabaseClient();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: orgId, room_type_id: "rt-1" }]);

    const result = await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      ratePlanIds: ["rp-1"],
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      fields: { rate: 333 },
    });

    expect(result).toEqual({ ok: true, rowsWritten: 1, skippedRatePlanIds: [] });
    expect(db.tables.room_type_rate_overrides).toHaveLength(1);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({
      rate_plan_id: "rp-1",
      date: "2026-11-21",
      rate: 333,
    });
    expect(db.tables.room_type_rate_overrides[0]).not.toHaveProperty("min_stay_arrival");
    expect(enqueueRestrictions).toHaveBeenCalledWith(
      db, orgId, "2026-11-21", "2026-11-22", ["rp-1"], ["rate"]
    );
  });

  it("preserves untouched fields on an existing row", async () => {
    const db = new FakeSupabaseClient();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: orgId, room_type_id: "rt-1" }]);
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: orgId, rate_plan_id: "rp-1", date: "2026-11-21", rate: 100, min_stay_arrival: 2, min_stay_through: null, max_stay: null, stop_sell: null, closed_to_arrival: null, closed_to_departure: null },
    ]);

    await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      ratePlanIds: ["rp-1"],
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      fields: { rate: 333 },
    });

    expect(db.tables.room_type_rate_overrides).toHaveLength(1);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({ rate: 333, min_stay_arrival: 2 });
  });

  it("expands a multi-date range into one row per date", async () => {
    const db = new FakeSupabaseClient();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: orgId, room_type_id: "rt-1" }]);

    await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      ratePlanIds: ["rp-1"],
      dateFrom: "2026-11-01",
      dateTo: "2026-11-03",
      fields: { stop_sell: true },
    });

    expect(db.tables.room_type_rate_overrides.map((r: any) => r.date).sort()).toEqual([
      "2026-11-01", "2026-11-02", "2026-11-03",
    ]);
  });

  it("rejects rate plans that don't belong to the org", async () => {
    const db = new FakeSupabaseClient();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: "other-org", room_type_id: "rt-1" }]);

    const result = await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      ratePlanIds: ["rp-1"],
      dateFrom: "2026-11-01",
      dateTo: "2026-11-01",
      fields: { rate: 100 },
    });

    expect(result.ok).toBe(false);
    expect(result.skippedRatePlanIds).toEqual(["rp-1"]);
    expect(db.tables.room_type_rate_overrides ?? []).toHaveLength(0);
  });

  it("skips rate plans that don't belong to the org but still writes the valid ones", async () => {
    const db = new FakeSupabaseClient();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: orgId, room_type_id: "rt-1" }]);

    const result = await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      ratePlanIds: ["rp-1", "rp-invalid"],
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      fields: { rate: 333 },
    });

    expect(result.ok).toBe(true);
    expect(result.skippedRatePlanIds).toEqual(["rp-invalid"]);
    expect(db.tables.room_type_rate_overrides).toHaveLength(1);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({ rate_plan_id: "rp-1" });
  });

  it("passes the exact set of touched field keys to enqueueRestrictions", async () => {
    const db = new FakeSupabaseClient();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: orgId, room_type_id: "rt-1" }]);

    await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      ratePlanIds: ["rp-1"],
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      fields: { rate: 333, stop_sell: true },
    });

    expect(enqueueRestrictions).toHaveBeenCalledWith(
      db, orgId, "2026-11-21", "2026-11-22", ["rp-1"], ["rate", "stop_sell"]
    );
  });

  it("dedupes a repeated rate plan id instead of writing/enqueueing it twice", async () => {
    const db = new FakeSupabaseClient();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: orgId, room_type_id: "rt-1" }]);

    const result = await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      ratePlanIds: ["rp-1", "rp-1"],
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      fields: { rate: 333 },
    });

    expect(result).toEqual({ ok: true, rowsWritten: 1, skippedRatePlanIds: [] });
    expect(db.tables.room_type_rate_overrides).toHaveLength(1);
    expect(enqueueRestrictions).toHaveBeenCalledWith(
      db, orgId, "2026-11-21", "2026-11-22", ["rp-1"], ["rate"]
    );
  });
});

describe("clearRateOverrideField", () => {
  it("nulls just the given field and enqueues a push for that date with that one touched field", async () => {
    const db = new FakeSupabaseClient();
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: orgId, rate_plan_id: "rp-1", date: "2026-11-21", rate: 333, min_stay_arrival: 2, min_stay_through: null, max_stay: null, stop_sell: null, closed_to_arrival: null, closed_to_departure: null },
    ]);

    const result = await clearRateOverrideField(db as unknown as SupabaseClient, orgId, "ov-1", "rate");

    expect(result.ok).toBe(true);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({ rate: null, min_stay_arrival: 2 });
    expect(enqueueRestrictions).toHaveBeenCalledWith(
      db, orgId, "2026-11-21", "2026-11-22", ["rp-1"], ["rate"]
    );
  });
});
