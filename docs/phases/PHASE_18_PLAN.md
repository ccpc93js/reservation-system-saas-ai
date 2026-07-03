# Phase 18: Housekeeping / Room Status

## Understanding Summary

- A housekeeping board tracking per-bed cleaning status (Clean / Dirty / Inspected / Out-of-Order), on a new dedicated `/housekeeping` page with its own sidebar nav entry.
- Exists because no housekeeping tracking exists in the app at all today, despite check-in/check-out timestamps already providing the natural trigger point.
- Audience: all org staff (owner/manager/staff) — same "everyone sees everything" model as Phase 17 notifications, no separate housekeeper role.
- Behavior: checkout auto-flips a bed to Dirty. Staff manually advance Dirty → Clean → Inspected. Booking/checking a guest into a non-Inspected bed is allowed but shows a non-blocking warning.
- Live-updating via Supabase Realtime, same `postgres_changes` pattern as Phase 17, since front desk and housekeeping view this concurrently.
- Non-goals: task assignment/due times, cleaner-specific queues, notification-bell integration (would spam on every checkout), status-change history/audit trail.

## Assumptions

1. Status lives directly on the `beds` row (3 new columns), not a separate history table — current-state only.
2. Any staff member can change any bed's status — no per-user restriction beyond existing org membership.
3. New page needs full i18n coverage across all 11 languages, matching every other page (Phase 16 precedent).
4. Out-of-Order is manual-only (never auto-set) and, like Dirty, doesn't block booking — just warns. Checkout must not overwrite an `out_of_order` bed back to `dirty`.
5. RLS follows the existing per-organization pattern already on `beds` — no new policy needed.

## Decision Log

| Decision | Alternatives considered | Why chosen |
|---|---|---|
| Scope: simple per-bed status only | Status + task assignment/cleaner queue | User-selected; task assignment is real scope creep for a small-team hostel PMS |
| Auto-dirty on checkout | Fully manual status management | Removes one manual step per turnover, matches real housekeeping workflow |
| Non-blocking warning on dirty-bed check-in | Hard block | Avoids blocking legitimate front-desk overrides (early arrivals, understaffed cleaning) |
| Dedicated `/housekeeping` page + nav entry | Folded into existing Rooms page | Daily-use operational screen deserves its own nav entry, same as Reservations/Guests/Rooms; mixing with bed CRUD (admin) is the wrong altitude |
| Realtime live updates | Manual refresh only | Front desk and housekeeping view this concurrently; stale data causes double-cleaning or missed dirty beds |
| Data model: columns on `beds` (Approach A) | Separate `housekeeping_status` table (Approach B) | No history requirement confirmed, so a separate table only adds a join for no benefit |
| No notification-bell integration | Fire a notification on every dirty/clean transition | Every checkout would spam the Phase 17 notification feed; out of scope |

## Design

### 1. Data Model

```sql
alter table beds
  add column housekeeping_status text not null default 'clean'
    check (housekeeping_status in ('clean', 'dirty', 'inspected', 'out_of_order')),
  add column housekeeping_updated_at timestamptz not null default now(),
  add column housekeeping_updated_by uuid references auth.users(id);

alter publication supabase_realtime add table beds;
```

Existing `beds` RLS (org-scoped) covers the new columns automatically. Default `'clean'` means no backfill needed. `housekeeping_updated_by` is nullable — a "last touched by" pointer, not an audit trail.

### 2. Auto-Dirty on Checkout

`api/reservations/[id]/checkout/route.ts`, after the reservation-status update succeeds: fetch bed(s) via `reservation_items.bed_id` for this reservation, update to `'dirty'`, excluding any bed already `out_of_order`. Fire-and-forget — never blocks or fails the checkout itself.

```ts
const { data: items } = await supabase
  .from("reservation_items")
  .select("bed_id")
  .eq("reservation_id", id);

if (items?.length) {
  await supabase
    .from("beds")
    .update({ housekeeping_status: "dirty", housekeeping_updated_at: new Date().toISOString(), housekeeping_updated_by: null })
    .in("id", items.map((i) => i.bed_id))
    .neq("housekeeping_status", "out_of_order");
}
```

### 3. Manual Status API + Realtime

`PATCH /api/beds/[id]/housekeeping` — auth check, validates `status` against the 4 allowed values, updates the row with `housekeeping_updated_by: user.id`. RLS is the real backstop against cross-org writes.

Client: `useHousekeeping(orgId)` hook, same shape as Phase 17's `useNotifications` — initial fetch (beds joined with room/room_type for grouping) + `postgres_changes` UPDATE subscription filtered by `organization_id=eq.<orgId>` (org-wide, not per-user, since this is a shared board).

### 4. UI

New page `/housekeeping` (`src/app/[locale]/[slug]/housekeeping/`), grouped by room like the Rooms page. Each bed: name, colored status badge, quick-action status buttons (not a dropdown — fast single-tap staff action). Filter tabs: All / Dirty / Out of Order. New sidebar nav entry (broom/sparkles icon) between Rooms and Channels, plus `header.tsx`'s `pageTitles` map entry.

Warning badge in `new-reservation-drawer.tsx` and `tape-chart.tsx` bed-selection UI for any non-clean/non-inspected bed — non-blocking, per the confirmed decision.

New `housekeeping` i18n namespace (page title, 4 status labels, filter tabs, empty state) plus a few keys in whichever namespace the drawer/tape-chart warning tooltip lives in — all 11 languages.

### 5. Edge Cases

- No `reservation_items` row on checkout: guard skips the bed update, checkout still succeeds.
- Checkout on an `out_of_order` bed: excluded via `.neq(...)`, maintenance flag survives.
- Concurrent status changes: last write wins, no version check — acceptable at this scale, matches existing simple-status-field behavior elsewhere in the app.
- Realtime disconnect: re-fetch on page focus/mount, same as Phase 17.
- Bed deletion: no special handling, housekeeping columns just go with the row.
- New bed: defaults to `'clean'`.
- Multi-bed reservations (not the common case, not schema-enforced): checkout marks all associated beds dirty.

### 6. Verification Strategy

Same pattern as every prior phase (no test framework): `apply_migration` → `get_advisors`, `npx tsc --noEmit`, i18n key-diff + t()-call resolution scripts, `npm run build`, manual smoke test for auth-gated/Realtime behavior (cross-tab live updates, warning badge in booking flow, checkout auto-dirtying the correct bed).

## Out of Scope (explicit non-goals)

Task assignment, cleaner queues, due times, status-change history/audit trail, notification-bell integration, blocking check-in on dirty beds. Revisit only if raised later.
