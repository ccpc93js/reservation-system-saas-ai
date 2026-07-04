export const HOUSEKEEPING_STATUSES = ["clean", "dirty", "inspected", "out_of_order"] as const;

export type HousekeepingStatus = (typeof HOUSEKEEPING_STATUSES)[number];
