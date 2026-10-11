// src/lib/channels/channex-rates.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("./channex", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./channex")>();
  return {
    ...actual,
    channex: { ...actual.channex, pushRestrictions: vi.fn().mockResolvedValue(undefined) },
  };
});

import { channex } from "./channex";
import { pushRatesForOrg } from "./channex-rates";

const orgId = "org-1";

function seedProvisioned(db: FakeSupabaseClient, ratePlans: any[]) {
  db.seed("channel_provider_links", [
    { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
    ...ratePlans.map((rp) => ({
      kind: "rate_plan",
      local_id: rp.id,
      channex_id: `channex-${rp.id}`,
      organization_id: orgId,
    })),
  ]);
  db.seed("rate_plans", ratePlans.map((rp) => ({ ...rp, organization_id: orgId })));
}

describe("pushRatesForOrg", () => {
  beforeEach(() => {
    vi.mocked(channex.pushRestrictions).mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("skips a non-provisioned org", async () => {
    const db = new FakeSupabaseClient();
    const result = await pushRatesForOrg(db as unknown as SupabaseClient, orgId);
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe("org not provisioned");
    expect(channex.pushRestrictions).not.toHaveBeenCalled();
  });

  it("pushes rate in minor units plus every restriction field", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      {
        id: "rp-1",
        room_type_id: "rt-1",
        base_price: "25.00",
        stop_sell: false,
        closed_to_arrival: true,
        closed_to_departure: false,
        min_stay_arrival: 2,
        min_stay_through: null,
      },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-03" });

    expect(channex.pushRestrictions).toHaveBeenCalledTimes(1);
    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values).toEqual([
      {
        property_id: "prop-1",
        rate_plan_id: "channex-rp-1",
        date_from: "2026-07-01",
        date_to: "2026-07-02",
        rate: 2500,
        stop_sell: false,
        closed_to_arrival: true,
        closed_to_departure: false,
        min_stay_arrival: 2,
      },
    ]);
  });

  it("omits null min-stay fields rather than sending null", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rp-1", room_type_id: "rt-1", base_price: "25.00", stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values[0]).not.toHaveProperty("min_stay_arrival");
    expect(values[0]).not.toHaveProperty("min_stay_through");
  });

  it("only pushes rate plans that have a mapped Channex id", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channel_provider_links", [
      { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
      { kind: "rate_plan", local_id: "rp-mapped", channex_id: "channex-mapped", organization_id: orgId },
    ]);
    db.seed("rate_plans", [
      { id: "rp-mapped", organization_id: orgId, room_type_id: "rt-1", base_price: 10, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null },
      { id: "rp-unmapped", organization_id: orgId, room_type_id: "rt-1", base_price: 10, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values).toHaveLength(1);
    expect(values[0].rate_plan_id).toBe("channex-mapped");
  });

  it("an override's rate wins over the rate plan's base_price for its date; other dates fall back", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rp-1", room_type_id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
    ]);
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: orgId, rate_plan_id: "rp-1", date: "2026-07-02", rate: 333, min_stay_arrival: null, min_stay_through: null, max_stay: null, stop_sell: null, closed_to_arrival: null, closed_to_departure: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-04" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values).toEqual([
      { property_id: "prop-1", rate_plan_id: "channex-rp-1", date_from: "2026-07-01", date_to: "2026-07-01", rate: 10000, stop_sell: false, closed_to_arrival: false, closed_to_departure: false },
      { property_id: "prop-1", rate_plan_id: "channex-rp-1", date_from: "2026-07-02", date_to: "2026-07-02", rate: 33300, stop_sell: false, closed_to_arrival: false, closed_to_departure: false },
      { property_id: "prop-1", rate_plan_id: "channex-rp-1", date_from: "2026-07-03", date_to: "2026-07-03", rate: 10000, stop_sell: false, closed_to_arrival: false, closed_to_departure: false },
    ]);
  });

  it("compresses consecutive identical nights into one entry per rate plan", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rp-1", room_type_id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
      { id: "rp-2", room_type_id: "rt-2", base_price: 200, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-11" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values).toHaveLength(2);
    expect(values.find((v: any) => v.rate_plan_id === "channex-rp-1")).toMatchObject({ date_from: "2026-07-01", date_to: "2026-07-10", rate: 10000 });
    expect(values.find((v: any) => v.rate_plan_id === "channex-rp-2")).toMatchObject({ date_from: "2026-07-01", date_to: "2026-07-10", rate: 20000 });
  });

  it("two rate plans on the same room type push independently with their own prices", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rp-bar", room_type_id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
      { id: "rp-bnb", room_type_id: "rt-1", base_price: 120, stop_sell: false, closed_to_arrival: true, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values).toHaveLength(2);
    expect(values.find((v: any) => v.rate_plan_id === "channex-rp-bar")).toMatchObject({ rate: 10000, closed_to_arrival: false });
    expect(values.find((v: any) => v.rate_plan_id === "channex-rp-bnb")).toMatchObject({ rate: 12000, closed_to_arrival: true });
  });

  it("with touchedFields, includes only those fields even though others have effective values", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rp-1", room_type_id: "rt-1", base_price: 100, stop_sell: true, closed_to_arrival: true, closed_to_departure: true, min_stay_arrival: 3, min_stay_through: null, max_stay: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, {
      from: "2026-07-01", to: "2026-07-02",
      touchedFields: new Set(["rate"]),
    });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values[0]).toEqual({
      property_id: "prop-1", rate_plan_id: "channex-rp-1",
      date_from: "2026-07-01", date_to: "2026-07-01",
      rate: 10000,
    });
  });

  it("with touchedFields, omits min/max stay even when a value is set, if not in the touched set", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rp-1", room_type_id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: 5, min_stay_through: null, max_stay: 14 },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, {
      from: "2026-07-01", to: "2026-07-02",
      touchedFields: new Set(["stop_sell"]),
    });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values[0]).toEqual({
      property_id: "prop-1", rate_plan_id: "channex-rp-1",
      date_from: "2026-07-01", date_to: "2026-07-01",
      stop_sell: false,
    });
  });

  it("without touchedFields (full sync), behavior is unchanged — every field included", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rp-1", room_type_id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values[0]).toMatchObject({ rate: 10000, stop_sell: false, closed_to_arrival: false, closed_to_departure: false });
  });
});
