import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("./channex-outbox", () => ({ enqueueAvailability: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications", () => ({ notifyOrg: vi.fn().mockResolvedValue(undefined) }));

import { applyRevision, type ApplyResult } from "./channex-bookings";
import type { RevisionAttributes } from "./channex";

const orgId = "org-1";
const channexPropertyId = "channex-prop-1";
const channexRoomTypeId = "channex-rt-1";
const localRoomTypeId = "rt-1";

function baseDb(overrides: { roomType?: Partial<Record<string, any>>; rpcResult?: string | null } = {}) {
  const db = new FakeSupabaseClient();
  db.seed("channel_provider_links", [
    { kind: "property", local_id: orgId, channex_id: channexPropertyId, organization_id: orgId },
    { kind: "room_type", local_id: localRoomTypeId, channex_id: channexRoomTypeId, organization_id: orgId },
  ]);
  db.seed("room_types", [{ id: localRoomTypeId, type: "dorm", capacity: 6, ...overrides.roomType }]);
  db.seed("reservations", []);
  db.seed("guests", []);
  db.onRpc("create_channex_reservation", () => ({
    data: overrides.rpcResult === undefined ? "new-reservation-id" : overrides.rpcResult,
    error: null,
  }));
  return db;
}

function revision(overrides: Partial<RevisionAttributes> = {}): RevisionAttributes {
  return {
    booking_id: "booking-1",
    status: "new",
    property_id: channexPropertyId,
    ota_name: "Booking.com",
    arrival_date: "2026-07-01",
    departure_date: "2026-07-03",
    amount: "100.00",
    currency: "EUR",
    customer: { name: "Jane", surname: "Doe", mail: "jane@example.com" },
    rooms: [{ room_type_id: channexRoomTypeId, checkin_date: "2026-07-01", checkout_date: "2026-07-03", occupancy: { adults: 1 } }],
    ...overrides,
  };
}

describe("applyRevision", () => {
  it("skips a revision for a property not mapped to any org", async () => {
    const db = new FakeSupabaseClient();
    const result = await applyRevision(db as unknown as SupabaseClient, revision({ property_id: "unmapped-property" }));
    expect(result.action).toBe("skipped");
  });

  it("creates a new reservation for a new booking", async () => {
    const db = baseDb();
    const result = await applyRevision(db as unknown as SupabaseClient, revision());
    expect(result.action).toBe("created");
    expect(result.reservationId).toBe("new-reservation-id");
  });

  it("dedupes: a 'new' booking already imported is skipped, not re-created", async () => {
    const db = baseDb();
    db.seed("reservations", [{ id: "existing-1", organization_id: orgId, external_id: "booking-1", status: "confirmed" }]);
    const result = await applyRevision(db as unknown as SupabaseClient, revision());
    expect(result.action).toBe("skipped");
    expect(result.warning).toMatch(/already imported/);
  });

  it("cancels a known booking", async () => {
    const db = baseDb();
    db.seed("reservations", [{ id: "existing-1", organization_id: orgId, external_id: "booking-1", status: "confirmed" }]);
    const result = await applyRevision(db as unknown as SupabaseClient, revision({ status: "cancelled" }));
    expect(result.action).toBe("cancelled");
    expect(db.tables.reservations.find((r: any) => r.id === "existing-1")!.status).toBe("cancelled");
  });

  it("skips a cancellation for an unknown booking", async () => {
    const db = baseDb();
    const result = await applyRevision(db as unknown as SupabaseClient, revision({ status: "cancelled" }));
    expect(result.action).toBe("skipped");
    expect(result.warning).toMatch(/unknown/);
  });

  it("parks a modification of a held booking without mutating the reservation", async () => {
    const db = baseDb();
    db.seed("reservations", [
      { id: "existing-1", organization_id: orgId, external_id: "booking-1", status: "confirmed", check_in: "2026-07-01", check_out: "2026-07-03" },
    ]);
    db.seed("channex_pending_mods", []);

    const result = await applyRevision(
      db as unknown as SupabaseClient,
      revision({ status: "modified", amount: "150.00", rooms: [{ room_type_id: channexRoomTypeId, checkin_date: "2026-07-02", checkout_date: "2026-07-04" }] })
    );

    expect(result.action).toBe("modified_flagged");
    const reservation = db.tables.reservations.find((r: any) => r.id === "existing-1");
    expect(reservation).toBeDefined();
    expect(reservation!.status).toBe("confirmed");
    expect(reservation!.check_in).toBe("2026-07-01");
    expect(reservation!.check_out).toBe("2026-07-03");
    expect(db.tables.channex_pending_mods).toHaveLength(1);
    expect(db.tables.channex_pending_mods[0]).toMatchObject({
      reservation_id: "existing-1",
      new_check_in: "2026-07-02",
      new_check_out: "2026-07-04",
      new_amount: 150,
    });
  });

  it("imports an overbooking as a flagged, unassigned reservation rather than dropping it", async () => {
    const db = baseDb({ rpcResult: null });
    const result = await applyRevision(db as unknown as SupabaseClient, revision());

    expect(result.action).toBe("overbooking");
    expect(result.reservationId).toBeTruthy();
    const created = db.tables.reservations.find((r: any) => r.id === result.reservationId);
    expect(created).toBeDefined();
    expect(created!.overbooked).toBe(true);
    expect(created!.status).toBe("pending");
  });

  it("errors cleanly when the revision has no rooms", async () => {
    const db = baseDb();
    const result = await applyRevision(db as unknown as SupabaseClient, revision({ rooms: [] }));
    expect(result.action).toBe("error");
    expect(result.warning).toMatch(/no rooms/);
  });

  it("errors when the room's room_type_id isn't mapped to this org", async () => {
    const db = baseDb();
    const result = await applyRevision(
      db as unknown as SupabaseClient,
      revision({ rooms: [{ room_type_id: "some-other-channex-rt", checkin_date: "2026-07-01", checkout_date: "2026-07-03" }] })
    );
    expect(result.action).toBe("error");
    expect(result.warning).toMatch(/not mapped/);
  });
});
