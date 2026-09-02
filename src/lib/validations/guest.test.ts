// src/lib/validations/guest.test.ts
import { describe, it, expect } from "vitest";
import { createGuestSchema, updateGuestSchema } from "./guest";

const validGuest = { first_name: "Jane", last_name: "Doe" };

describe("createGuestSchema", () => {
  it("accepts a minimal valid guest", async () => {
    await expect(createGuestSchema.validate(validGuest)).resolves.toBeTruthy();
  });

  it("rejects a first_name that's too short", async () => {
    await expect(createGuestSchema.validate({ ...validGuest, first_name: "J" })).rejects.toThrow();
  });

  it("rejects an invalid email", async () => {
    await expect(createGuestSchema.validate({ ...validGuest, email: "not-an-email" })).rejects.toThrow();
  });

  it("accepts a valid email", async () => {
    await expect(
      createGuestSchema.validate({ ...validGuest, email: "jane@example.com" })
    ).resolves.toBeTruthy();
  });

  it("rejects a date_of_birth in the future", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    await expect(
      createGuestSchema.validate({ ...validGuest, date_of_birth: future })
    ).rejects.toThrow();
  });

  it("rejects an invalid document_type", async () => {
    await expect(
      createGuestSchema.validate({ ...validGuest, document_type: "id_card" })
    ).rejects.toThrow();
  });

  it("accepts a valid document_type", async () => {
    await expect(
      createGuestSchema.validate({ ...validGuest, document_type: "passport" })
    ).resolves.toBeTruthy();
  });
});

describe("updateGuestSchema", () => {
  it("accepts a partial update", async () => {
    await expect(updateGuestSchema.validate({ phone: "+1234567890" })).resolves.toBeTruthy();
  });

  it("accepts an empty object", async () => {
    await expect(updateGuestSchema.validate({})).resolves.toBeTruthy();
  });

  it("still validates email format when provided", async () => {
    await expect(updateGuestSchema.validate({ email: "bad" })).rejects.toThrow();
  });
});
