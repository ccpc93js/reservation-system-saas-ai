# Phase 17: Staff Notifications

## Understanding Summary

- In-app staff notification center, replacing the placeholder bell icon in `header.tsx` (hardcoded red dot, no data, no click handler) with a real dropdown backed by persisted, live-updating notifications.
- Exists because staff currently have no way to see new activity (check-ins, cancellations, sync failures) without manually navigating to each page.
- Audience: all members of an organization (org = property, via `memberships` table) — shared org-wide event set, per-user read state.
- Delivery: in-app dropdown + Supabase Realtime for live updates. No email digest, no SMS/push, no guest-facing notifications.

## Assumptions

1. Clicking a notification navigates to the relevant page/record.
2. "Mark all as read" bulk action exists alongside per-row mark-as-read.
3. Dropdown shows the last 50 notifications; no automatic deletion/retention job this phase.
4. Notification creation is fire-and-forget — must never block or fail the primary action (mirrors `sendEmail` error-swallowing in `src/lib/email.ts`).
5. RLS scopes notifications to `user_id = auth.uid()`, consistent with existing Supabase RLS patterns.
6. Team size is small (single-digit to low-dozens staff per org) — no queue/worker needed, direct DB insert + Realtime broadcast on the same request is sufficient.

## Trigger Events (5)

1. Guest self-check-in submitted (`api/guest-portal/[token]/submit-check-in`)
2. New reservation created (`api/reservations/create`)
3. Reservation cancelled (`api/reservations/[id]/cancel`)
4. Duplicate guest detected (guest create/merge dedup path)
5. Channel sync failure (`api/channels/[id]/sync`, `api/channels/sync-all`)

## Decision Log

| Decision | Alternatives considered | Why chosen |
|---|---|---|
| Scope: in-app + Realtime, no email digest | Static-only in-app; in-app + email; guest-facing | Realtime is cheap once the table exists; email is a separate concern with no signal it's wanted yet |
| 5 trigger events | Broader list (low occupancy, payment due, etc.) | User-selected; others not requested, YAGNI |
| Audience: all org members, no role filtering | Role-based per-event rules | Simpler; small teams don't need per-role gating yet |
| Data model: per-user fan-out rows (Approach A) | Shared table + read-tracking join (B); Realtime Broadcast + separate persistence (C) | Simplest RLS (`user_id = auth.uid()`), simplest Realtime filter, simplest unread-count query; row duplication trivial at this scale |
| Notification content: structured `type` + `data` jsonb, translated at render time | Store pre-rendered title/body text | App is fully i18n'd (Phase 16); baked-in English text would break for non-English-viewing staff |
| Error handling: fire-and-forget, never blocks primary action | Synchronous, fail request if notify fails | Matches `sendEmail` precedent; a notification failure must never break a check-in/booking |
| No DB pruning/retention job this phase | Scheduled cleanup job | Row counts trivial at this scale; add later if needed |

## Design

### 1. Data Model

```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null references auth.users(id),
  type text not null,          -- 'checkin_submitted' | 'reservation_created' | 'reservation_cancelled' | 'duplicate_guest' | 'channel_sync_failed'
  link text,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, read_at, created_at desc);
alter publication supabase_realtime add table notifications;
```

RLS: `user_id = auth.uid()` for select/update. Inserts happen server-side only via the service-role client (same pattern as `settings/team/route.ts`) — no insert policy needed for regular users.

### 2. Server-Side Triggers

New helper `src/lib/notifications.ts`:

```ts
async function notifyOrg(orgId: string, type: NotificationType, data: Record<string, any>, link?: string, excludeUserId?: string) {
  const service = await createServiceClient();
  const { data: members } = await service.from("memberships").select("user_id").eq("organization_id", orgId);
  if (!members?.length) return;
  const rows = members
    .filter(m => m.user_id !== excludeUserId)
    .map(m => ({ organization_id: orgId, user_id: m.user_id, type, data, link }));
  const { error } = await service.from("notifications").insert(rows);
  if (error) console.error("notifyOrg failed:", error); // never throws
}
```

Wired into the 5 routes listed above, one line each, after the primary action succeeds. `excludeUserId` skips notifying the staff member who performed the action themselves (not used for the two system-detected events: duplicate guest, channel sync failure).

### 3. Client State + Realtime

New hook `src/hooks/use-notifications.ts`: initial fetch (last 50, newest first) + a `postgres_changes` INSERT subscription filtered on `user_id=eq.<me>`, prepending new rows live. Re-fetch on dropdown open as a safety net for Realtime reconnect gaps / multi-tab drift. `markRead`/`markAllRead` are optimistic client updates backed by `PATCH /api/notifications/[id]/read` and `/api/notifications/mark-all-read` (RLS is the real backstop regardless).

### 4. Bell Dropdown UI

Replaces the placeholder in `header.tsx:273-277`. Radix `DropdownMenu` (already used elsewhere in the same file). Badge shows unread count (capped display). Each row: type icon, translated title/body via `t(`notifications.${type}`, data)`, relative timestamp, unread visual distinction. Click → mark read + locale-aware navigate to `link`, closes dropdown. Header "Mark all as read" button. Empty state. New `notifications` i18n namespace across all 11 languages, same script-based workflow as every prior Phase 16 stage.

### 5. Edge Cases

- Insert failure: caught, logged, never throws.
- New org members: no backfill, only see notifications from after they joined.
- Removed org members: notifications become inert (RLS + loss of dashboard access), no cleanup job.
- Realtime disconnect: auto-reconnect + re-fetch on dropdown open covers the gap.
- Self-notification loop: prevented via `excludeUserId` for actor-driven events.
- Row growth: 50-row client cap; no DB pruning this phase.

### 6. Verification Strategy

1. Migration via `mcp__supabase__apply_migration`, then `mcp__supabase__get_advisors` for RLS/security check before app code.
2. `npx tsc --noEmit` after each stage.
3. i18n key-set diff + t()-call resolution scripts (same as every Phase 16 stage).
4. `npm run build`.
5. Manual smoke test (auth-gated, can't automate): trigger each of the 5 events live, confirm live badge update without refresh, correct translated text, mark-as-read/mark-all-read, and cross-tab/session Realtime delivery.

## Out of Scope (explicit non-goals)

Email digest, SMS/push, guest-facing notifications, role-based filtering, multi-property scoping, DB retention/pruning job. Revisit only if raised later.
