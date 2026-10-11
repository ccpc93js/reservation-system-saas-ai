// src/lib/channels/channex-doctor.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("./channex", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./channex")>();
  return {
    ...actual,
    channex: {
      ...actual.channex,
      listProperties: vi.fn().mockResolvedValue([]),
      getAvailability: vi.fn().mockResolvedValue({}),
      bookingFeed: vi.fn().mockResolvedValue({ meta: { total: 0 } }),
      listWebhooks: vi.fn().mockResolvedValue([]),
    },
  };
});

import { runDoctor } from "./channex-doctor";

const orgId = "org-1";

function seedProvisioned(db: FakeSupabaseClient) {
  db.seed("channel_provider_links", [
    { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
    { kind: "room_type", local_id: "rt-1", channex_id: "channex-rt-1", organization_id: orgId },
  ]);
  db.seed("room_types", [{ id: "rt-1", organization_id: orgId, name: "Twin Room" }]);
}

async function mappingsCheck(db: FakeSupabaseClient) {
  const report = await runDoctor(db as unknown as SupabaseClient, orgId);
  return report.checks.find((c) => c.name === "mappings_complete")!;
}

describe("runDoctor — mappings_complete", () => {
  beforeEach(() => {
    process.env.CHANNEX_API_KEY = "test-key";
  });
  afterEach(() => {
    delete process.env.CHANNEX_API_KEY;
  });

  it("checks rate plan links against rate_plans.id, not room_type.id", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db);
    db.seed("rate_plans", [{ id: "rp-1", organization_id: orgId, room_type_id: "rt-1", name: "Standard Rate" }]);
    // Linked by the rate plan's own id — the current (post-fix) keying.
    db.tables.channel_provider_links.push({ kind: "rate_plan", local_id: "rp-1", channex_id: "channex-rp-1", organization_id: orgId });

    const check = await mappingsCheck(db);

    expect(check.ok).toBe(true);
    expect(check.detail).not.toContain("unmapped");
  });

  it("reports a rate plan as unmapped by name, not a false pass against the room type's id", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db);
    db.seed("rate_plans", [{ id: "rp-1", organization_id: orgId, room_type_id: "rt-1", name: "Bed & Breakfast" }]);
    // No rate_plan-kind link at all for rp-1.

    const check = await mappingsCheck(db);

    expect(check.ok).toBe(false);
    expect(check.detail).toContain("Twin Room — Bed & Breakfast (rate plan)");
  });

  it("reports each of a room type's several rate plans independently", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db);
    db.seed("rate_plans", [
      { id: "rp-bar", organization_id: orgId, room_type_id: "rt-1", name: "Best Available Rate" },
      { id: "rp-bnb", organization_id: orgId, room_type_id: "rt-1", name: "Bed & Breakfast" },
    ]);
    db.tables.channel_provider_links.push({ kind: "rate_plan", local_id: "rp-bar", channex_id: "channex-rp-bar", organization_id: orgId });
    // rp-bnb left unmapped.

    const check = await mappingsCheck(db);

    expect(check.ok).toBe(false);
    expect(check.detail).toContain("Bed & Breakfast (rate plan)");
    expect(check.detail).not.toContain("Best Available Rate");
  });
});
