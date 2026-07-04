import * as yup from "yup";

// Empty <input type="number"> yields NaN via react-hook-form's valueAsNumber;
// coerce empty/NaN to null so optional numeric fields don't fail validation.
const optionalNumber = () =>
  yup
    .number()
    .transform((value, original) =>
      original === "" || original === null || original === undefined || Number.isNaN(value) ? null : value
    )
    .nullable()
    .optional();

// Room Type Schemas
export const createRoomTypeSchema = yup.object().shape({
  name: yup.string().min(2, "Name must be at least 2 characters").max(100, "Name must be at most 100 characters").required("Room type name is required"),
  type: yup.string().oneOf(["dorm", "private"], "Type must be either dorm or private").required("Room type is required"),
  gender: yup.string().oneOf(["", "mixed", "female", "male"], "Invalid gender selection").nullable(),
  capacity: yup.number().min(1, "Capacity must be at least 1").max(20, "Capacity must be at most 20").required("Capacity is required"),
  base_price: yup.number().min(0.01, "Price must be greater than 0").required("Base price is required"),
  description: yup.string().max(500, "Description must be at most 500 characters").nullable().optional(),
});

export const updateRoomTypeSchema = createRoomTypeSchema.shape({
  name: yup.string().min(2, "Name must be at least 2 characters").max(100, "Name must be at most 100 characters").optional(),
  type: yup.string().oneOf(["dorm", "private"], "Type must be either dorm or private").optional(),
  capacity: yup.number().min(1, "Capacity must be at least 1").max(20, "Capacity must be at most 20").optional(),
  base_price: yup.number().min(0.01, "Price must be greater than 0").optional(),
});

// Room Schemas
export const createRoomSchema = yup.object().shape({
  room_type_id: yup.string().uuid("Room type must be a valid ID").required("Room type is required"),
  name: yup.string().min(2, "Name must be at least 2 characters").max(100, "Name must be at most 100 characters").required("Room name is required"),
  floor: optionalNumber(),
  notes: yup.string().max(500, "Notes must be at most 500 characters").nullable().optional(),
});

export const updateRoomSchema = createRoomSchema.shape({
  room_type_id: yup.string().uuid("Room type must be a valid ID").optional(),
  name: yup.string().min(2, "Name must be at least 2 characters").max(100, "Name must be at most 100 characters").optional(),
});

// Bed Schemas
export const createBedSchema = yup.object().shape({
  room_id: yup.string().uuid("Room must be a valid ID").required("Room is required"),
  name: yup.string().min(1, "Bed name is required").max(100, "Name must be at most 100 characters").required("Bed name is required"),
  position: optionalNumber(),
  is_active: yup.boolean().optional(),
});

export const updateBedSchema = createBedSchema.shape({
  room_id: yup.string().uuid("Room must be a valid ID").optional(),
  name: yup.string().min(1, "Bed name is required").max(100, "Name must be at most 100 characters").optional(),
});
