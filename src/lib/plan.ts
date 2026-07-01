export type Plan = "free" | "pro" | "scale";

export const PLAN_LIMITS: Record<Plan, {
  beds: number;        // -1 = unlimited
  users: number;       // -1 = unlimited
  guestBook: number;   // -1 = unlimited
  channels: boolean;
  portal: boolean;
  analytics: boolean;
  multiProperty: boolean;
}> = {
  free: {
    beds: 20,
    users: 1,
    guestBook: 500,
    channels: false,
    portal: false,
    analytics: false,
    multiProperty: false,
  },
  pro: {
    beds: 60,
    users: 3,
    guestBook: 5000,
    channels: true,
    portal: true,
    analytics: true,
    multiProperty: false,
  },
  scale: {
    beds: -1,
    users: -1,
    guestBook: -1,
    channels: true,
    portal: true,
    analytics: true,
    multiProperty: true,
  },
};

export const PLAN_NAMES: Record<Plan, string> = {
  free: "Starter",
  pro: "Pro",
  scale: "Scale",
};

export const PLAN_PRICES: Record<Plan, string> = {
  free: "Free",
  pro: "€19/mo",
  scale: "€39/mo",
};

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[(plan as Plan)] ?? PLAN_LIMITS.free;
}

export function hasFeature(plan: string, feature: keyof typeof PLAN_LIMITS.free): boolean {
  const limits = getPlanLimits(plan);
  return limits[feature] as boolean;
}

export function canAddGuestBookEntry(plan: string, currentCount: number): boolean {
  const { guestBook } = getPlanLimits(plan);
  return guestBook === -1 || currentCount < guestBook;
}

export function getGuestBookLimit(plan: string): number {
  return getPlanLimits(plan).guestBook;
}

export function canAddBed(plan: string, currentBeds: number): boolean {
  const { beds } = getPlanLimits(plan);
  return beds === -1 || currentBeds < beds;
}

export function canAddUser(plan: string, currentUsers: number): boolean {
  const { users } = getPlanLimits(plan);
  return users === -1 || currentUsers < users;
}

export function getBedLimit(plan: string): number {
  return getPlanLimits(plan).beds;
}

export function getUserLimit(plan: string): number {
  return getPlanLimits(plan).users;
}

// Stripe price IDs
export const STRIPE_PRICES = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
  scale_monthly: process.env.STRIPE_PRICE_SCALE_MONTHLY!,
} as const;

export const PRICE_TO_PLAN: Record<string, Plan> = {
  [process.env.STRIPE_PRICE_PRO_MONTHLY ?? ""]: "pro",
  [process.env.STRIPE_PRICE_SCALE_MONTHLY ?? ""]: "scale",
};
