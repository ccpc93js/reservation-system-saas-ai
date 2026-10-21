// src/lib/channels/channex-outbox.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("./channex-availability", () => ({ pushAvailabilityForOrg: vi.fn() }));
vi.mock("./channex-rates", () => ({ pushRatesForOrgScoped: vi.fn() }));

import { pushAvailabilityForOrg } from "./channex-availability";
import { pushRatesForOrgScoped } from "./channex-rates";
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

  it("stores touched_fields on the inserted row when enqueueRestrictions is given one", async () => {
    const db = new FakeSupabaseClient();
    provisioned(db);
    await enqueueRestrictions(db as unknown as SupabaseClient, orgId, "2026-07-01", "2026-07-02", ["rp-1"], ["rate", "stop_sell"]);
    expect(db.tables.channex_outbox[0]).toMatchObject({ touched_fields: ["rate", "stop_sell"] });
  });

  it("leaves touched_fields null when enqueueRestrictions isn't given any", async () => {
    const db = new FakeSupabaseClient();
    provisioned(db);
    await enqueueRestrictions(db as unknown as SupabaseClient, orgId, "2026-07-01", "2026-07-02", ["rp-1"]);
    expect(db.tables.channex_outbox[0].touched_fields).toBeUndefined();
  });
});

describe("processOutbox", () => {
  beforeEach(() => {
    vi.mocked(pushAvailabilityForOrg).mockReset().mockResolvedValue({ ok: true, propertyId: "p", roomTypesPushed: 1, entries: 1 });
    vi.mocked(pushRatesForOrgScoped).mockReset().mockResolvedValue({ ok: true, propertyId: "p", ratePlansPushed: 1, entries: 1 });
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

  it("persists the Channex task ids returned by the push onto the sent rows", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [
      pendingRow({ id: "a" }),
      pendingRow({ id: "b", from_date: "2026-07-03", to_date: "2026-07-05" }),
    ]);
    vi.mocked(pushAvailabilityForOrg).mockResolvedValue({
      ok: true, propertyId: "p", roomTypesPushed: 1, entries: 1,
      channexTaskIds: ["task-1", "task-2"],
    });

    const result = await processOutbox(db as unknown as SupabaseClient);

    expect(result.channexTaskIds).toEqual(["task-1", "task-2"]);
    expect(db.tables.channex_outbox[0].task_ids).toEqual(["task-1", "task-2"]);
    expect(db.tables.channex_outbox[1].task_ids).toEqual(["task-1", "task-2"]);
  });

  it("leaves task_ids unset when the push response carries no task ids", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [pendingRow()]);
    vi.mocked(pushAvailabilityForOrg).mockResolvedValue({
      ok: true, propertyId: "p", roomTypesPushed: 1, entries: 1,
    });

    await processOutbox(db as unknown as SupabaseClient);

    expect(db.tables.channex_outbox[0].task_ids).toBeUndefined();
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

describe("processOutbox — restrictions rows coalesce into one scoped call", () => {
  beforeEach(() => {
    vi.mocked(pushRatesForOrgScoped).mockReset().mockResolvedValue({ ok: true, propertyId: "p", ratePlansPushed: 1, entries: 1 });
  });

  function restrictionsRow(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: overrides.id ?? "row-1",
      organization_id: orgId,
      kind: "restrictions",
      from_date: "2026-07-01",
      to_date: "2026-07-02",
      room_type_ids: ["rp-1"],
      status: "pending",
      attempts: 0,
      next_attempt_at: null,
      created_at: "2026-01-01T00:00:00Z",
      touched_fields: null,
      ...overrides,
    };
  }

  it("passes a single row through as one scope with its own touched_fields", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [restrictionsRow({ touched_fields: ["rate"] })]);

    await processOutbox(db as unknown as SupabaseClient);

    expect(pushRatesForOrgScoped).toHaveBeenCalledTimes(1);
    const [, , scopes] = vi.mocked(pushRatesForOrgScoped).mock.calls[0];
    expect(scopes).toEqual([
      { from: "2026-07-01", to: "2026-07-02", roomTypeLocalIds: ["rp-1"], touchedFields: new Set(["rate"]) },
    ]);
  });

  it("coalesces several rows into one call, each keeping its own date range and rate plan — never unioned", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [
      restrictionsRow({ id: "a", room_type_ids: ["rp-twin-bar"], from_date: "2026-11-21", to_date: "2026-11-22", touched_fields: ["rate"] }),
      restrictionsRow({ id: "b", room_type_ids: ["rp-double-bar"], from_date: "2026-11-25", to_date: "2026-11-26", touched_fields: ["rate"] }),
      restrictionsRow({ id: "c", room_type_ids: ["rp-double-bnb"], from_date: "2026-11-29", to_date: "2026-11-30", touched_fields: ["rate"] }),
    ]);

    const result = await processOutbox(db as unknown as SupabaseClient);

    // One call total — this is what certification actually checks (call count).
    expect(pushRatesForOrgScoped).toHaveBeenCalledTimes(1);
    expect(result.calls).toBe(1);
    const [, , scopes] = vi.mocked(pushRatesForOrgScoped).mock.calls[0];
    // Each row's own narrow range survives untouched — no row's date range
    // got widened to cover another row's dates (the actual production bug:
    // a flat union window caused each rate plan's computation to span every
    // other row's dates too, leaking baseline-default values into them).
    expect(scopes).toEqual([
      { from: "2026-11-21", to: "2026-11-22", roomTypeLocalIds: ["rp-twin-bar"], touchedFields: new Set(["rate"]) },
      { from: "2026-11-25", to: "2026-11-26", roomTypeLocalIds: ["rp-double-bar"], touchedFields: new Set(["rate"]) },
      { from: "2026-11-29", to: "2026-11-30", roomTypeLocalIds: ["rp-double-bnb"], touchedFields: new Set(["rate"]) },
    ]);
    expect(db.tables.channex_outbox.every((r: any) => r.status === "sent")).toBe(true);
  });

  it("a row with touched_fields: null becomes a full-snapshot scope without forcing other rows in the same call to full snapshot too", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [
      restrictionsRow({ id: "a", touched_fields: ["rate"] }),
      restrictionsRow({ id: "b", room_type_ids: ["rp-2"], touched_fields: null }),
    ]);

    await processOutbox(db as unknown as SupabaseClient);

    const [, , scopes] = vi.mocked(pushRatesForOrgScoped).mock.calls[0];
    expect(scopes[0].touchedFields).toEqual(new Set(["rate"]));
    expect(scopes[1].touchedFields).toBeUndefined();
  });

  it("a row with room_type_ids: null becomes an all-rate-plans scope", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [restrictionsRow({ room_type_ids: null })]);

    await processOutbox(db as unknown as SupabaseClient);

    const [, , scopes] = vi.mocked(pushRatesForOrgScoped).mock.calls[0];
    expect(scopes[0].roomTypeLocalIds).toBeUndefined();
  });
});
