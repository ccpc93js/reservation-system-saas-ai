import * as yup from "yup";
import { OVERRIDE_FIELD_KEYS } from "@/lib/rate-overrides";

const optionalNumber = () =>
  yup
    .number()
    .transform((value, original) =>
      original === "" || original === null || original === undefined || Number.isNaN(value) ? undefined : value
    )
    .optional();

export const applyRateOverridesSchema = yup
  .object()
  .shape({
    room_type_ids: yup.array().of(yup.string().required()).min(1, "Select at least one room type").required(),
    date_from: yup.string().required("Start date is required"),
    date_to: yup
      .string()
      .required("End date is required")
      .test("after-from", "End date must be on or after start date", function (value) {
        return !value || !this.parent.date_from || value >= this.parent.date_from;
      }),
    rate: optionalNumber().min(0.01, "Rate must be greater than 0"),
    min_stay_arrival: optionalNumber().min(1, "Min stay must be at least 1 night"),
    min_stay_through: optionalNumber().min(1, "Min stay must be at least 1 night"),
    max_stay: optionalNumber().min(1, "Max stay must be at least 1 night"),
    stop_sell: yup.boolean().optional(),
    closed_to_arrival: yup.boolean().optional(),
    closed_to_departure: yup.boolean().optional(),
  })
  .test("at-least-one-field", "Set at least one field to apply", (value) =>
    OVERRIDE_FIELD_KEYS.some((k) => (value as Record<string, unknown> | undefined)?.[k] !== undefined)
  );
