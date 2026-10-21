// src/lib/channels/channex-availability.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("./channex", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./channex")>();
  return {
    ...actual,
    channex: { ...actual.channex, pushAvailability: vi.fn().mockResolvedValue(undefined) },
  };
});

import { channex } from "./channex";
import { pushAvailabilityForOrg, pushAvailabilityForOrgScoped } from "./channex-availability";

const orgId = "org-1";

describe("pushAvailabilityForOrg", () => {
  beforeEach(() => {
    vi.mocked(channex.pushAvailability).mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("skips a non-provisioned org", async () => {
    const db = new FakeSupabaseClient();
    const result = await pushAvailabilityForOrg(db as unknown as SupabaseClient, orgId);
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe("org not provisioned");
    expect(channex.pushAvailability).not.toHaveBeenCalled();
  });

  it("maps free_beds_ranges rows to AvailabilityValue via the mapped room type id", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channel_provider_links", [
      { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
      { kind: "room_type", local_id: "rt-1", channex_id: "channex-rt-1", organization_id: orgId },
    ]);
    db.onRpc("free_beds_ranges", () => ({
      data: [{ room_type_id: "rt-1", date_from: "2026-07-01", date_to: "2026-07-05", free: 3 }],
      error: null,
    }));

    const result = await pushAvailabilityForOrg(db as unknown as SupabaseClient, orgId, {
      from: "2026-07-01",
      to: "2026-08-01",
    });

    expect(result.ok).toBe(true);
    expect(channex.pushAvailability).toHaveBeenCalledWith([
      { property_id: "prop-1", room_type_id: "channex-rt-1", date_from: "2026-07-01", date_to: "2026-07-05", availability: 3 },
    ]);
  });

  it("drops ranges for room types with no Channex mapping", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channel_provider_links", [
      { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
      { kind: "room_type", local_id: "rt-mapped", channex_id: "channex-mapped", organization_id: orgId },
    ]);
    db.onRpc("free_beds_ranges", () => ({
      data: [
        { room_type_id: "rt-mapped", date_from: "2026-07-01", date_to: "2026-07-02", free: 1 },
        { room_type_id: "rt-unmapped", date_from: "2026-07-01", date_to: "2026-07-02", free: 5 },
      ],
      error: null,
    }));

    await pushAvailabilityForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-08-01" });

    const [values] = vi.mocked(channex.pushAvailability).mock.calls[0];
    expect(values).toHaveLength(1);
    expect(values[0].room_type_id).toBe("channex-mapped");
  });

  it("returns ok:false with the RPC error message on an RPC failure", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channel_provider_links", [
      { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
      { kind: "room_type", local_id: "rt-1", channex_id: "channex-rt-1", organization_id: orgId },
    ]);
    db.onRpc("free_beds_ranges", () => ({ data: null, error: { message: "boom" } }));

    const result = await pushAvailabilityForOrg(db as unknown as SupabaseClient, orgId, {
      from: "2026-07-01",
      to: "2026-08-01",
    });

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe("boom");
  });
});

describe("pushAvailabilityForOrgScoped", () => {
  beforeEach(() => {
    vi.mocked(channex.pushAvailability).mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  function provisioned(db: FakeSupabaseClient) {
    db.seed("channel_provider_links", [
      { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
      { kind: "room_type", local_id: "rt-twin", channex_id: "channex-twin", organization_id: orgId },
      { kind: "room_type", local_id: "rt-double", channex_id: "channex-double", organization_id: orgId },
    ]);
  }

  it("sends nothing and makes no call for an empty scope list", async () => {
    const db = new FakeSupabaseClient();
    const result = await pushAvailabilityForOrgScoped(db as unknown as SupabaseClient, orgId, []);
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe("no scopes");
    expect(channex.pushAvailability).not.toHaveBeenCalled();
  });

  it("the exact certification regression: two room types' scopes combine into one call, each keeping only its own date window", async () => {
    const db = new FakeSupabaseClient();
    provisioned(db);
    // Before the fix, coalescing these two rows unioned the window to
    // 2026-11-10..2026-11-25 and pushed BOTH room types across the full
    // union — correct values outside each room's real override, wrong
    // coverage, exactly what certification flagged ("Twin Room: covers
    // 2026-11-10..2026-11-24, expected 2026-11-10..2026-11-16").
    db.onRpc("free_beds_ranges", (args: any) => {
      if (args.p_from === "2026-11-10" && args.p_to === "2026-11-17") {
        return { data: [{ room_type_id: "rt-twin", date_from: "2026-11-10", date_to: "2026-11-17", free: 3 }], error: null };
      }
      if (args.p_from === "2026-11-17" && args.p_to === "2026-11-25") {
        return { data: [{ room_type_id: "rt-double", date_from: "2026-11-17", date_to: "2026-11-25", free: 4 }], error: null };
      }
      throw new Error(`unexpected rpc args: ${JSON.stringify(args)}`);
    });

    const result = await pushAvailabilityForOrgScoped(db as unknown as SupabaseClient, orgId, [
      { from: "2026-11-10", to: "2026-11-17", roomTypeLocalIds: ["rt-twin"] },
      { from: "2026-11-17", to: "2026-11-25", roomTypeLocalIds: ["rt-double"] },
    ]);

    expect(result.ok).toBe(true);
    expect(channex.pushAvailability).toHaveBeenCalledTimes(1);
    expect(channex.pushAvailability).toHaveBeenCalledWith([
      { property_id: "prop-1", room_type_id: "channex-twin", date_from: "2026-11-10", date_to: "2026-11-17", availability: 3 },
      { property_id: "prop-1", room_type_id: "channex-double", date_from: "2026-11-17", date_to: "2026-11-25", availability: 4 },
    ]);
  });

  it("an unmapped roomTypeLocalIds filter in one scope produces no entries for it, without affecting other scopes", async () => {
    const db = new FakeSupabaseClient();
    provisioned(db);
    db.onRpc("free_beds_ranges", (args: any) => ({
      data: [
        { room_type_id: "rt-twin", date_from: args.p_from, date_to: args.p_to, free: 2 },
        { room_type_id: "rt-unmapped", date_from: args.p_from, date_to: args.p_to, free: 9 },
      ],
      error: null,
    }));

    await pushAvailabilityForOrgScoped(db as unknown as SupabaseClient, orgId, [
      { from: "2026-07-01", to: "2026-07-02", roomTypeLocalIds: ["rt-twin", "rt-unmapped"] },
    ]);

    const [values] = vi.mocked(channex.pushAvailability).mock.calls[0];
    expect(values).toHaveLength(1);
    expect(values[0].room_type_id).toBe("channex-twin");
  });

  it("returns ok:false with the RPC error message if any scope's RPC fails", async () => {
    const db = new FakeSupabaseClient();
    provisioned(db);
    db.onRpc("free_beds_ranges", () => ({ data: null, error: { message: "boom" } }));

    const result = await pushAvailabilityForOrgScoped(db as unknown as SupabaseClient, orgId, [
      { from: "2026-07-01", to: "2026-07-02" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe("boom");
  });
});
