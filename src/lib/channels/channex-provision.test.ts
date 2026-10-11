// src/lib/channels/channex-provision.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("./channex", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./channex")>();
  return {
    ...actual,
    channex: {
      ...actual.channex,
      createProperty: vi.fn().mockResolvedValue({ id: "prop-1" }),
      updateProperty: vi.fn().mockResolvedValue({ id: "prop-1" }),
      createRoomType: vi.fn().mockResolvedValue({ id: "channex-rt-1" }),
      updateRoomType: vi.fn().mockResolvedValue({ id: "channex-rt-1" }),
      createRatePlan: vi.fn().mockImplementation((attrs: any) => Promise.resolve({ id: `channex-${attrs.title}` })),
      updateRatePlan: vi.fn().mockImplementation((id: string) => Promise.resolve({ id })),
    },
  };
});

import { channex } from "./channex";
import { provisionOrg } from "./channex-provision";

const orgId = "org-1";

function seedOrgAndRoom(db: FakeSupabaseClient) {
  db.seed("organizations", [{ id: orgId, name: "Test Hotel", currency: "USD", timezone: "UTC" }]);
  db.seed("room_types", [{ id: "rt-1", organization_id: orgId, name: "Twin Room", type: "private", capacity: 2, base_price: 100 }]);
  db.seed("rooms", [{ id: "room-1", organization_id: orgId, room_type_id: "rt-1" }]);
}

describe("provisionOrg — rate plans", () => {
  beforeEach(() => {
    vi.mocked(channex.createRatePlan).mockClear();
    vi.mocked(channex.updateRatePlan).mockClear();
  });

  it("creates one Channex rate plan per local rate_plans row, not per room type", async () => {
    const db = new FakeSupabaseClient();
    seedOrgAndRoom(db);
    db.seed("rate_plans", [
      { id: "rp-bar", organization_id: orgId, room_type_id: "rt-1", name: "Best Available Rate", base_price: 100, is_default: true },
      { id: "rp-bnb", organization_id: orgId, room_type_id: "rt-1", name: "Bed & Breakfast", base_price: 120, is_default: false },
    ]);

    const result = await provisionOrg(db as unknown as SupabaseClient, orgId);

    expect(channex.createRatePlan).toHaveBeenCalledTimes(2);
    expect(channex.createRatePlan).toHaveBeenCalledWith(expect.objectContaining({ title: "Best Available Rate" }));
    expect(channex.createRatePlan).toHaveBeenCalledWith(expect.objectContaining({ title: "Bed & Breakfast" }));
    expect(result.rows.filter((r) => r.kind === "rate_plan")).toHaveLength(2);

    const links = db.tables.channel_provider_links.filter((l: any) => l.kind === "rate_plan");
    expect(links.map((l: any) => l.local_id).sort()).toEqual(["rp-bar", "rp-bnb"]);
  });

  it("uses the rate plan's own base_price, not the room type's", async () => {
    const db = new FakeSupabaseClient();
    seedOrgAndRoom(db);
    db.seed("rate_plans", [
      { id: "rp-1", organization_id: orgId, room_type_id: "rt-1", name: "Standard Rate", base_price: 150, is_default: true },
    ]);

    await provisionOrg(db as unknown as SupabaseClient, orgId);

    const call = vi.mocked(channex.createRatePlan).mock.calls[0][0];
    expect(call.options?.[0].rate).toBe(15000); // minor units
  });

  it("re-runs idempotently — an already-linked rate plan is updated, not re-created", async () => {
    const db = new FakeSupabaseClient();
    seedOrgAndRoom(db);
    db.seed("rate_plans", [
      { id: "rp-1", organization_id: orgId, room_type_id: "rt-1", name: "Standard Rate", base_price: 100, is_default: true },
    ]);
    db.seed("channel_provider_links", [
      { organization_id: orgId, kind: "property", local_id: orgId, channex_id: "prop-1" },
      { organization_id: orgId, kind: "room_type", local_id: "rt-1", channex_id: "channex-rt-1" },
      { organization_id: orgId, kind: "rate_plan", local_id: "rp-1", channex_id: "channex-existing" },
    ]);

    await provisionOrg(db as unknown as SupabaseClient, orgId);

    expect(channex.createRatePlan).not.toHaveBeenCalled();
    expect(channex.updateRatePlan).toHaveBeenCalledWith("channex-existing", expect.anything());
  });
});
