// src/lib/channels/channex-outbox.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("./channex-availability", () => ({ pushAvailabilityForOrg: vi.fn() }));
vi.mock("./channex-rates", () => ({ pushRatesForOrg: vi.fn() }));

import { pushAvailabilityForOrg } from "./channex-availability";
import { pushRatesForOrg } from "./channex-rates";
import { enqueueAvailability, enqueueRestrictions, processOutbox } from "./channex-outbox";

const orgId = "org-1";

function provisioned(db: FakeSupabaseClient) {
  db.seed("channel_provider_links", [{ kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId }]);
}

describe("enqueueAvailability / enqueueRestrictions", () => {
  it("no-ops for an org with no Channex property link", async () => {
    const db = new FakeSupabaseClient();
    await enqueueAvailability(db as unknown as SupabaseClient, orgId, "2026-07-01", "2026-07-02");
    expect(db.tables.channex_outbox ?? []).toHaveLength(0);
  });

  it("inserts a pending row for a provisioned org", async () => {
    const db = new FakeSupabaseClient();
    provisioned(db);
    await enqueueRestrictions(db as unknown as SupabaseClient, orgId, "2026-07-01", "2026-07-02", ["rt-1"]);
    expect(db.tables.channex_outbox).toHaveLength(1);
    expect(db.tables.channex_outbox[0]).toMatchObject({
      organization_id: orgId,
      kind: "restrictions",
      from_date: "2026-07-01",
      to_date: "2026-07-02",
      room_type_ids: ["rt-1"],
    });
  });

  it("does nothing when from/to are missing", async () => {
    const db = new FakeSupabaseClient();
    provisioned(db);
    await enqueueAvailability(db as unknown as SupabaseClient, orgId, undefined, undefined);
    expect(db.tables.channex_outbox ?? []).toHaveLength(0);
  });
});

describe("processOutbox", () => {
  beforeEach(() => {
    vi.mocked(pushAvailabilityForOrg).mockReset().mockResolvedValue({ ok: true, propertyId: "p", roomTypesPushed: 1, entries: 1 });
    vi.mocked(pushRatesForOrg).mockReset().mockResolvedValue({ ok: true, propertyId: "p", ratePlansPushed: 1, entries: 1 });
  });

  function pendingRow(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: overrides.id ?? "row-1",
      organization_id: orgId,
      kind: "availability",
      from_date: "2026-07-01",
      to_date: "2026-07-02",
      room_type_ids: null,
      status: "pending",
      attempts: 0,
      next_attempt_at: null,
      created_at: "2026-01-01T00:00:00Z",
      ...overrides,
    };
  }

  it("groups multiple pending rows for the same (org, kind) into a single push call", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [
      pendingRow({ id: "a", from_date: "2026-07-01", to_date: "2026-07-02" }),
      pendingRow({ id: "b", from_date: "2026-07-03", to_date: "2026-07-05" }),
    ]);

    const result = await processOutbox(db as unknown as SupabaseClient);

    expect(pushAvailabilityForOrg).toHaveBeenCalledTimes(1);
    expect(pushAvailabilityForOrg).toHaveBeenCalledWith(db, orgId, { from: "2026-07-01", to: "2026-07-05", roomTypeLocalIds: undefined });
    expect(result.sent).toBe(2);
    expect(db.tables.channex_outbox.every((r: any) => r.status === "sent")).toBe(true);
  });

  it("widens to all room types (undefined filter) if any grouped row has room_type_ids: null", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [
      pendingRow({ id: "a", room_type_ids: ["rt-1"] }),
      pendingRow({ id: "b", room_type_ids: null }),
    ]);

    await processOutbox(db as unknown as SupabaseClient);

    const [, , opts] = vi.mocked(pushAvailabilityForOrg).mock.calls[0];
    expect(opts?.roomTypeLocalIds).toBeUndefined();
  });

  it("retries with exponential backoff on a transient (network) push failure", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [pendingRow()]);
    vi.mocked(pushAvailabilityForOrg).mockRejectedValue(Object.assign(new Error("timeout"), { status: undefined }));

    const before = Date.now();
    const result = await processOutbox(db as unknown as SupabaseClient);

    expect(result.retried).toBe(1);
    expect(db.tables.channex_outbox[0].status).toBe("pending");
    expect(db.tables.channex_outbox[0].attempts).toBe(1);
    const nextAttemptAt = new Date(db.tables.channex_outbox[0].next_attempt_at).getTime();
    // First retry backoff is 15_000 * 2**(1-1) = 15000ms. Allow a small tolerance
    // for real wall-clock time elapsed during the test run.
    expect(nextAttemptAt).toBeGreaterThanOrEqual(before + 15000);
    expect(nextAttemptAt).toBeLessThan(before + 16000);
  });

  it("parks a permanent (4xx) push failure as status:error without retrying", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [pendingRow()]);
    const { ChannexError } = await import("./channex");
    vi.mocked(pushAvailabilityForOrg).mockRejectedValue(new ChannexError(422, "bad_request", "nope"));

    const result = await processOutbox(db as unknown as SupabaseClient);

    expect(result.errored).toBe(1);
    expect(db.tables.channex_outbox[0].status).toBe("error");
  });

  it("stops issuing calls once maxCalls is reached, leaving the rest pending", async () => {
    const db = new FakeSupabaseClient();
    // Row "a" (org-a) is expected to be processed before row "b" (org-b): the
    // fake client's order() is a no-op, so select() returns rows in seed
    // order, which is also the order groups get inserted into (and iterated
    // from) the Map in processOutbox — i.e. processing order == seed order.
    db.seed("channex_outbox", [
      pendingRow({ id: "a", organization_id: "org-a" }),
      pendingRow({ id: "b", organization_id: "org-b" }),
    ]);

    const result = await processOutbox(db as unknown as SupabaseClient, 1);

    expect(result.rateLimited).toBe(true);
    expect(result.calls).toBe(1);
    const statuses = db.tables.channex_outbox.map((r: any) => r.status).sort();
    expect(statuses).toEqual(["pending", "sent"]);
  });
});
