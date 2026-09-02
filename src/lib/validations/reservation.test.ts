// src/lib/validations/reservation.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createReservationSchema,
  updateReservationDatesSchema,
  cancelReservationSchema,
} from "./reservation";

const validUuid = "11111111-1111-1111-1111-111111111111";

describe("createReservationSchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const base = {
    guest_id: "new",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    check_in: "2026-06-16",
    check_out: "2026-06-18",
    price_per_night: 50,
    bed_id: validUuid,
    org_id: validUuid,
  };

  it("accepts a valid new-guest reservation", async () => {
    await expect(createReservationSchema.validate(base)).resolves.toBeTruthy();
  });

  it("rejects a check_in date in the past", async () => {
    await expect(
      createReservationSchema.validate({ ...base, check_in: "2026-06-01" })
    ).rejects.toThrow();
  });

  it("rejects check_out before check_in", async () => {
    await expect(
      createReservationSchema.validate({ ...base, check_in: "2026-06-20", check_out: "2026-06-18" })
    ).rejects.toThrow();
  });

  it("rejects a non-positive price_per_night", async () => {
    await expect(createReservationSchema.validate({ ...base, price_per_night: 0 })).rejects.toThrow();
  });

  it("rejects a malformed bed_id", async () => {
    await expect(createReservationSchema.validate({ ...base, bed_id: "not-a-uuid" })).rejects.toThrow();
  });

  it("requires first_name when guest_id is 'new'", async () => {
    await expect(
      createReservationSchema.validate({ ...base, guest_id: "new", first_name: "" })
    ).rejects.toThrow();
  });

  it("requires last_name when guest_id is 'new'", async () => {
    await expect(
      createReservationSchema.validate({ ...base, guest_id: "new", last_name: "" })
    ).rejects.toThrow();
  });

  it("requires email when guest_id is 'new'", async () => {
    await expect(
      createReservationSchema.validate({ ...base, guest_id: "new", email: "" })
    ).rejects.toThrow();
  });

  it("does not require first_name/last_name when guest_id is an existing guest", async () => {
    const { first_name, last_name, email, ...rest } = base;
    await expect(
      createReservationSchema.validate({ ...rest, guest_id: validUuid })
    ).resolves.toBeTruthy();
  });
});

describe("updateReservationDatesSchema", () => {
  it("accepts valid, ordered dates", async () => {
    await expect(
      updateReservationDatesSchema.validate({ check_in: "2026-06-16", check_out: "2026-06-18" })
    ).resolves.toBeTruthy();
  });

  it("rejects check_out before check_in", async () => {
    await expect(
      updateReservationDatesSchema.validate({ check_in: "2026-06-18", check_out: "2026-06-16" })
    ).rejects.toThrow();
  });

  it("allows omitting both dates", async () => {
    await expect(updateReservationDatesSchema.validate({})).resolves.toBeTruthy();
  });
});

describe("cancelReservationSchema", () => {
  it("accepts a valid cancellation reason", async () => {
    await expect(
      cancelReservationSchema.validate({ cancellation_reason: "guest_request" })
    ).resolves.toBeTruthy();
  });

  it("rejects an invalid cancellation reason", async () => {
    await expect(
      cancelReservationSchema.validate({ cancellation_reason: "changed_my_mind" })
    ).rejects.toThrow();
  });
});
