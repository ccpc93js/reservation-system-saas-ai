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

function seedProvisioned(db: FakeSupabaseClient, roomTypes: any[]) {
  db.seed("channel_provider_links", [
    { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
    ...roomTypes.map((rt) => ({
      kind: "rate_plan",
      local_id: rt.id,
      channex_id: `rp-${rt.id}`,
      organization_id: orgId,
    })),
  ]);
  db.seed("room_types", roomTypes.map((rt) => ({ ...rt, organization_id: orgId })));
}

describe("pushRatesForOrg", () => {
  // pushRatesForOrg clamps `from` to today (`opts.from > todayISO() ? opts.from
  // : todayISO()`), so date assertions below need "today" pinned before the
  // fixture dates — otherwise this test silently breaks once real "today"
  // passes 2026-07-01.
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
        id: "rt-1",
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
        rate_plan_id: "rp-rt-1",
        date_from: "2026-07-01",
        date_to: "2026-07-02", // to is exclusive; last night is one before it
        rate: 2500,
        stop_sell: false,
        closed_to_arrival: true,
        closed_to_departure: false,
        min_stay_arrival: 2,
        // min_stay_through omitted entirely — null, not sent as null
      },
    ]);
  });

  it("omits null min-stay fields rather than sending null", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      {
        id: "rt-1",
        base_price: "25.00",
        stop_sell: false,
        closed_to_arrival: false,
        closed_to_departure: false,
        min_stay_arrival: null,
        min_stay_through: null,
      },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values[0]).not.toHaveProperty("min_stay_arrival");
    expect(values[0]).not.toHaveProperty("min_stay_through");
  });

  it("only pushes room types that have a mapped rate plan", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channel_provider_links", [
      { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
      // rt-mapped has a rate_plan link; rt-unmapped does not
      { kind: "rate_plan", local_id: "rt-mapped", channex_id: "rp-mapped", organization_id: orgId },
    ]);
    db.seed("room_types", [
      { id: "rt-mapped", organization_id: orgId, base_price: 10, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null },
      { id: "rt-unmapped", organization_id: orgId, base_price: 10, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values).toHaveLength(1);
    expect(values[0].rate_plan_id).toBe("rp-mapped");
  });
});
