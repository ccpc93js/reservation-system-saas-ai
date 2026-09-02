// src/lib/validations/room.test.ts
import { describe, it, expect } from "vitest";
import {
  createRoomTypeSchema,
  updateRoomTypeSchema,
  createRoomSchema,
  createBedSchema,
} from "./room";

const validRoomType = {
  name: "Standard Dorm",
  type: "dorm",
  gender: "mixed",
  capacity: 6,
  base_price: 25,
};

describe("createRoomTypeSchema", () => {
  it("accepts a minimal valid room type", async () => {
    await expect(createRoomTypeSchema.validate(validRoomType)).resolves.toBeTruthy();
  });

  it("rejects a name that's too short", async () => {
    await expect(createRoomTypeSchema.validate({ ...validRoomType, name: "A" })).rejects.toThrow();
  });

  it("rejects an invalid type", async () => {
    await expect(createRoomTypeSchema.validate({ ...validRoomType, type: "suite" })).rejects.toThrow();
  });

  it("rejects capacity above 20", async () => {
    await expect(createRoomTypeSchema.validate({ ...validRoomType, capacity: 21 })).rejects.toThrow();
  });

  it("rejects a zero base_price", async () => {
    await expect(createRoomTypeSchema.validate({ ...validRoomType, base_price: 0 })).rejects.toThrow();
  });

  it("accepts stop_sell / closed_to_arrival / closed_to_departure booleans", async () => {
    const result = await createRoomTypeSchema.validate({
      ...validRoomType,
      stop_sell: true,
      closed_to_arrival: true,
      closed_to_departure: false,
    });
    expect(result.stop_sell).toBe(true);
    expect(result.closed_to_arrival).toBe(true);
    expect(result.closed_to_departure).toBe(false);
  });

  it("accepts a positive min_stay_arrival / min_stay_through", async () => {
    const result = await createRoomTypeSchema.validate({
      ...validRoomType,
      min_stay_arrival: 2,
      min_stay_through: 3,
    });
    expect(result.min_stay_arrival).toBe(2);
    expect(result.min_stay_through).toBe(3);
  });

  it("rejects min_stay_arrival below 1", async () => {
    await expect(
      createRoomTypeSchema.validate({ ...validRoomType, min_stay_arrival: 0 })
    ).rejects.toThrow();
  });

  it("coerces an empty-string min_stay_arrival to null instead of failing", async () => {
    const result = await createRoomTypeSchema.validate({ ...validRoomType, min_stay_arrival: "" as any });
    expect(result.min_stay_arrival).toBeNull();
  });
});

describe("updateRoomTypeSchema", () => {
  it("accepts a partial update with only base_price", async () => {
    await expect(updateRoomTypeSchema.validate({ base_price: 30 })).resolves.toBeTruthy();
  });

  it("accepts an empty object (all fields optional on update)", async () => {
    await expect(updateRoomTypeSchema.validate({})).resolves.toBeTruthy();
  });

  it("still rejects an out-of-range base_price when provided", async () => {
    await expect(updateRoomTypeSchema.validate({ base_price: -5 })).rejects.toThrow();
  });
});

describe("createRoomSchema", () => {
  it("accepts a valid room", async () => {
    await expect(
      createRoomSchema.validate({ room_type_id: "any-id", name: "Room 101" })
    ).resolves.toBeTruthy();
  });

  it("requires room_type_id", async () => {
    await expect(createRoomSchema.validate({ name: "Room 101" })).rejects.toThrow();
  });
});

describe("createBedSchema", () => {
  it("accepts a valid bed", async () => {
    await expect(createBedSchema.validate({ room_id: "any-id", name: "Bed 1" })).resolves.toBeTruthy();
  });

  it("requires a non-empty bed name", async () => {
    await expect(createBedSchema.validate({ room_id: "any-id", name: "" })).rejects.toThrow();
  });
});
