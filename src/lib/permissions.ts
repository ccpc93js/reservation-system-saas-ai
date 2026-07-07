// Role-based access control.
//
// Roles: owner > manager (admin is treated as manager) > staff.
// Any section NOT listed in SECTION_ROLES is open to every member (staff too).
// Restricted sections list the roles allowed to reach them.

export type Role = "owner" | "manager" | "admin" | "staff";

const MANAGERS: readonly Role[] = ["owner", "manager", "admin"];
const OWNER_ONLY: readonly Role[] = ["owner"];

// Keyed by the nav item's `path` (and reused for SSR page gating).
export const SECTION_ROLES: Record<string, readonly Role[]> = {
  analytics: MANAGERS,
  channels: MANAGERS,
  "settings/property": MANAGERS,
  "settings/billing": OWNER_ONLY,
  // settings/team is open to all — staff see it read-only.
};

export function canAccessSection(role: string | undefined, section: string): boolean {
  const allowed = SECTION_ROLES[section];
  return !allowed || (!!role && allowed.includes(role as Role));
}

export const isManager = (role: string | undefined): boolean =>
  !!role && MANAGERS.includes(role as Role);

export const isOwner = (role: string | undefined): boolean => role === "owner";
