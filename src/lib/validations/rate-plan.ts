import * as yup from "yup";

const optionalNumber = () =>
  yup
    .number()
    .transform((value, original) =>
      original === "" || original === null || original === undefined || Number.isNaN(value) ? null : value
    )
    .nullable()
    .optional();

export const createRatePlanSchema = yup.object().shape({
  name: yup.string().min(1, "Name is required").max(100, "Name must be at most 100 characters").required("Name is required"),
  base_price: yup.number().min(0.01, "Price must be greater than 0").required("Base price is required"),
  stop_sell: yup.boolean().optional(),
  closed_to_arrival: yup.boolean().optional(),
  closed_to_departure: yup.boolean().optional(),
  min_stay_arrival: optionalNumber().min(1, "Min stay must be at least 1 night"),
  min_stay_through: optionalNumber().min(1, "Min stay must be at least 1 night"),
  max_stay: optionalNumber().min(1, "Max stay must be at least 1 night"),
});

export const updateRatePlanSchema = createRatePlanSchema.shape({
  name: yup.string().min(1, "Name is required").max(100, "Name must be at most 100 characters").optional(),
  base_price: yup.number().min(0.01, "Price must be greater than 0").optional(),
});
