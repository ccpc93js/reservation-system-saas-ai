# Phase 17 Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the placeholder bell icon in the dashboard header to a real, persisted, live-updating staff notification system covering 5 events (check-in submitted, reservation created/cancelled, duplicate guest, channel sync failure).

**Architecture:** One Postgres table (`notifications`, per-user fan-out rows) written server-side via a fire-and-forget helper called from 5 existing API routes; a client hook does an initial fetch plus a Supabase Realtime `postgres_changes` subscription filtered to the signed-in user; a new `NotificationBell` component replaces the placeholder in `header.tsx`. Notification text is never stored — only a `type` + structured `data` jsonb, rendered through next-intl at display time so it respects each viewer's language.

**Tech Stack:** Next.js 15 (App Router), Supabase (Postgres + RLS + Realtime), next-intl, Radix DropdownMenu, TypeScript.

**Full design rationale:** `docs/phases/PHASE_17_PLAN.md` (read this first if anything below is ambiguous — it has the decision log).

**No test framework in this repo** (confirmed precedent from Phase 16). Every task's "verify" step uses `npx tsc --noEmit`, the two Phase-16-style i18n verification scripts, `npm run build`, and/or `mcp__supabase__get_advisors` — not unit tests. This is a deliberate deviation from the skill's default TDD template.

---

### Task 1: Database migration

**Files:**
- Create (via MCP, no local file needed): applied directly with `mcp__supabase__apply_migration`, name it `create_notifications_table`.

**Step 1: Check existing schema shape first**

Run `mcp__supabase__list_tables` and confirm `organizations`, `memberships` column names match what's assumed below (`memberships.organization_id`, `memberships.user_id`). If they differ, adjust the migration accordingly before applying.

**Step 2: Apply the migration**

```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  link text,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_read_at_idx on notifications (user_id, read_at, created_at desc);

alter table notifications enable row level security;

create policy "Users can view their own notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "Users can update read state on their own notifications"
  on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter publication supabase_realtime add table notifications;
```

Use `mcp__supabase__apply_migration` with this SQL.

**Step 3: Verify with advisors**

Run `mcp__supabase__get_advisors` (type: security). Confirm no new warnings about the `notifications` table (e.g. missing RLS, overly permissive policy). Fix and re-apply if anything is flagged.

**Step 4: Commit**

No local file changed by this task (migration lives in Supabase) — skip commit, note the migration name in the Task 3 commit message instead.

---

### Task 2: Notification type constants + server helper

**Files:**
- Create: `src/lib/notifications.ts`

**Step 1: Write the helper**

```ts
import { createServiceClient } from "@/lib/supabase/server";

export type NotificationType =
  | "checkin_submitted"
  | "reservation_created"
  | "reservation_cancelled"
  | "duplicate_guest"
  | "channel_sync_failed";

export async function notifyOrg(
  organizationId: string,
  type: NotificationType,
  data: Record<string, unknown>,
  link?: string,
  excludeUserId?: string
): Promise<void> {
  try {
    const service = await createServiceClient();
    const { data: members, error: membersError } = await service
      .from("memberships")
      .select("user_id")
      .eq("organization_id", organizationId);

    if (membersError || !members?.length) {
      if (membersError) console.error("notifyOrg: failed to load members", membersError);
      return;
    }

    const rows = members
      .filter((m) => m.user_id !== excludeUserId)
      .map((m) => ({
        organization_id: organizationId,
        user_id: m.user_id,
        type,
        data,
        link: link ?? null,
      }));

    if (rows.length === 0) return;

    const { error } = await (service.from("notifications") as any).insert(rows);
    if (error) console.error("notifyOrg: insert failed", error);
  } catch (err) {
    console.error("notifyOrg: unexpected error", err);
  }
}
```

This function must never throw — every call site below uses it fire-and-forget (`.catch()` or simply not awaited-critically), same as `sendEmail`.

**Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from this file (it has no callers yet, so it just needs to compile standalone).

**Step 3: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat: add notifyOrg helper for Phase 17 notifications"
```

---

### Task 3: Wire into guest self-check-in submission

**Files:**
- Modify: `src/app/api/guest-portal/[token]/submit-check-in/route.ts:1-3` (imports), `:215-221` (after email send)

**Step 1: Add the import**

```ts
import { createServiceClient } from "@/lib/supabase/server";
import { sendCheckInSubmittedEmail } from "@/lib/email";
import { notifyOrg } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";
```

**Step 2: Add the notify call right after the existing email send**

Existing code (around line 215-221):
```ts
    // Send confirmation email
    await sendCheckInSubmittedEmail(
      email,
      firstName,
      (reservation as any).reservation_number || "RES-XX-XXXX",
      reservation.check_in
    ).catch((err) => console.error("Email send failed:", err));
```

Add immediately after it:
```ts
    // Notify staff
    await notifyOrg(
      reservation.organization_id,
      "checkin_submitted",
      {
        guestName: `${firstName} ${lastName}`,
        reservationNumber: (reservation as any).reservation_number || "RES-XX-XXXX",
      },
      "/check-in-pending"
    );
```

No `excludeUserId` here — the guest submits this, not a staff member, so there's no actor to exclude.

**Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Step 4: Commit**

```bash
git add "src/app/api/guest-portal/[token]/submit-check-in/route.ts"
git commit -m "feat: notify staff on guest check-in submission"
```

---

### Task 4: Wire into reservation creation

**Files:**
- Modify: `src/app/api/reservations/create/route.ts:4` (import), `:207-218` (after email send)

**Step 1: Add the import**

```ts
import { sendReservationConfirmationEmail } from "@/lib/email";
import { notifyOrg } from "@/lib/notifications";
```

**Step 2: Add the notify call after the existing email block**

Existing code (around line 207-218):
```ts
    // Send confirmation email
    if (guest?.email) {
      await sendReservationConfirmationEmail(
        guest.email,
        `${data.first_name} ${data.last_name}`,
        reservation.id.substring(0, 8).toUpperCase(),
        data.check_in,
        data.check_out,
        room?.beds?.rooms?.name,
        totalPrice
      ).catch((err) => console.error("Email send failed:", err));
    }
```

Add immediately after (still inside the same `try` block, before `return Response.json(...)`):
```ts
    // Notify staff (excluding whoever created it)
    await notifyOrg(
      data.org_id,
      "reservation_created",
      {
        guestName: `${data.first_name} ${data.last_name}`,
        reservationNumber: reservation.id.substring(0, 8).toUpperCase(),
        roomName: room?.beds?.rooms?.name ?? null,
      },
      "/reservations",
      user.id
    );
```

Check the variable name for the current user in this file — it's fetched near the top as `user` from `supabase.auth.getUser()` (confirmed at route.ts:47). Use that exact name; do not re-fetch.

**Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Step 4: Commit**

```bash
git add src/app/api/reservations/create/route.ts
git commit -m "feat: notify staff on new reservation created"
```

---

### Task 5: Wire into reservation cancellation

**Files:**
- Modify: `src/app/api/reservations/[id]/cancel/route.ts:2` (import), `:98-112` (after email send)

**Step 1: Add the import**

```ts
import { createServerClient } from "@/lib/supabase/server";
import { sendReservationCancelledEmail } from "@/lib/email";
import { notifyOrg } from "@/lib/notifications";
```

**Step 2: Add the notify call inside the existing `if (resData?.guest_id)` block**

Existing code (around line 98-112):
```ts
    if (resData?.guest_id) {
      const { data: guest } = await supabase
        .from("guests")
        .select("first_name, last_name, email")
        .eq("id", resData.guest_id)
        .single();

      if (guest?.email) {
        await sendReservationCancelledEmail(
          guest.email,
          `${guest.first_name} ${guest.last_name}`,
          id.substring(0, 8).toUpperCase()
        ).catch((err) => console.error("Email send failed:", err));
      }
    }
```

Replace with (adds notify outside the `guest?.email` check, since a notification shouldn't depend on the guest having an email on file):
```ts
    if (resData?.guest_id) {
      const { data: guest } = await supabase
        .from("guests")
        .select("first_name, last_name, email")
        .eq("id", resData.guest_id)
        .single();

      if (guest?.email) {
        await sendReservationCancelledEmail(
          guest.email,
          `${guest.first_name} ${guest.last_name}`,
          id.substring(0, 8).toUpperCase()
        ).catch((err) => console.error("Email send failed:", err));
      }

      await notifyOrg(
        reservation.organization_id,
        "reservation_cancelled",
        {
          guestName: guest ? `${guest.first_name} ${guest.last_name}` : null,
          reservationNumber: id.substring(0, 8).toUpperCase(),
        },
        "/reservations",
        user.id
      );
    }
```

`reservation.organization_id` and `user.id` are both already in scope from earlier in this function (lines 16, 31).

**Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Step 4: Commit**

```bash
git add "src/app/api/reservations/[id]/cancel/route.ts"
git commit -m "feat: notify staff on reservation cancellation"
```

---

### Task 6: Wire into duplicate guest detection

**Files:**
- Modify: `src/app/api/guests/create/route.ts` (near line 79, the `console.log("Duplicate guest detected:", existingGuest)` line)

**Step 1: Read the surrounding function first**

Read `src/app/api/guests/create/route.ts` lines 1-95 to confirm the exact variable names for `orgId` and the current user (needed for `excludeUserId` — the staff member attempting to create the guest should NOT get notified about their own duplicate hit, since they already see it in the UI immediately as a 409 response).

**Step 2: Add the import**

```ts
import { notifyOrg } from "@/lib/notifications";
```

**Step 3: Add the notify call**

Existing code (around line 78-89):
```ts
      if (existingGuest) {
        console.log("Duplicate guest detected:", existingGuest);
        return Response.json(
          {
            error: "Guest with this document already exists",
            duplicate: true,
            existingGuest: {
              id: existingGuest.id,
              name: `${existingGuest.first_name} ${existingGuest.last_name}`,
              document_type: existingGuest.document_type,
              document_number: existingGuest.document_number,
            },
```

Add the notify call right after the `console.log` line, before `return Response.json`:
```ts
      if (existingGuest) {
        console.log("Duplicate guest detected:", existingGuest);
        await notifyOrg(
          orgId,
          "duplicate_guest",
          {
            guestName: `${existingGuest.first_name} ${existingGuest.last_name}`,
            documentNumber: existingGuest.document_number,
          },
          "/guests",
          currentUserId
        );
        return Response.json(
```

Use whatever the actual current-user-id variable is called in this file (confirm during Step 1 — it may not exist yet if this route uses the service client without an auth check; if there's no authenticated user in scope, omit the `excludeUserId` argument entirely rather than inventing a variable).

**Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Step 5: Commit**

```bash
git add src/app/api/guests/create/route.ts
git commit -m "feat: notify staff on duplicate guest detection"
```

---

### Task 7: Wire into channel sync failure

**Files:**
- Modify: `src/app/api/channels/[id]/sync/route.ts:1` (import), `:72-77` (iCal fetch failure), `:218-220` (outer catch)

**Step 1: Add the import**

```ts
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { notifyOrg } from "@/lib/notifications";
```

**Step 2: Read the channel record's name/platform field**

Read lines 53-65 of this file to confirm what field holds the channel's display name (likely `platform` or `name` on the `channel` object fetched around line 53) — use that in the notification `data`.

**Step 3: Add notify call in the iCal fetch failure catch (around line 72-77)**

Existing code:
```ts
    } catch (err: any) {
      await serviceClient.from("channels")
        .update({ last_error: `Failed to fetch feed: ${err.message}`, updated_at: new Date().toISOString() })
        ...
      return Response.json({ error: "Failed to fetch iCal feed" }, { status: 422 });
```

Add the notify call before the `return`:
```ts
    } catch (err: any) {
      await serviceClient.from("channels")
        .update({ last_error: `Failed to fetch feed: ${err.message}`, updated_at: new Date().toISOString() })
        ...
      await notifyOrg(
        orgId,
        "channel_sync_failed",
        { channelName: channel?.platform ?? "channel", reason: err.message },
        "/channels"
      );
      return Response.json({ error: "Failed to fetch iCal feed" }, { status: 422 });
```

No `excludeUserId` — this is a system-detected failure, not a user-initiated one worth excluding the actor for (per the design doc's Section 5).

**Step 4: Add notify call in the outer catch (around line 218-220)**

Existing code:
```ts
  } catch (err: any) {
    console.error("Sync error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
```

Add:
```ts
  } catch (err: any) {
    console.error("Sync error:", err);
    if (typeof orgId! === "string") {
      await notifyOrg(orgId, "channel_sync_failed", { channelName: "channel", reason: err.message }, "/channels");
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
```

`orgId` is declared with `let orgId: string;` near the top of the function (line 28) but may not be assigned yet if the failure happens before it's set — guard with the type check shown, or wrap in `try { } catch {}` if `orgId` might be undefined at this point. Confirm by reading the full function before editing.

**Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Step 6: Commit**

```bash
git add "src/app/api/channels/[id]/sync/route.ts"
git commit -m "feat: notify staff on channel sync failure"
```

---

### Task 8: Mark-as-read API routes

**Files:**
- Create: `src/app/api/notifications/[id]/read/route.ts`
- Create: `src/app/api/notifications/mark-all-read/route.ts`

**Step 1: Write the single mark-as-read route**

```ts
import { createServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await (supabase.from("notifications") as any)
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return Response.json({ error: "Failed to mark as read" }, { status: 400 });
  return Response.json({ success: true });
}
```

**Step 2: Write the mark-all-read route**

```ts
import { createServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await (supabase.from("notifications") as any)
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) return Response.json({ error: "Failed to mark all as read" }, { status: 400 });
  return Response.json({ success: true });
}
```

Both rely on RLS (`user_id = auth.uid()`) as the real backstop — the explicit `.eq("user_id", user.id)` is defense in depth, not the only guard.

**Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Step 4: Commit**

```bash
git add src/app/api/notifications
git commit -m "feat: add mark-as-read and mark-all-read notification endpoints"
```

---

### Task 9: Client hook

**Files:**
- Create: `src/hooks/use-notifications.ts`

**Step 1: Check the hooks directory convention**

Run `ls src/hooks` (or Glob `src/hooks/*.ts`) first — if this directory doesn't exist yet, check whether other custom hooks in this codebase live elsewhere (e.g. inline in components) before creating a new top-level directory. If no `src/hooks` convention exists, put this in `src/lib/hooks/use-notifications.ts` instead and adjust the import path in Task 10 accordingly.

**Step 2: Write the hook**

```ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export interface AppNotification {
  id: string;
  type: string;
  link: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export function useNotifications(userId: string) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchLatest = useCallback(async () => {
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data as AppNotification[]) ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    fetchLatest();

    const supabase = createBrowserClient();
    const channel = supabase
      .channel("notifications-self")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setItems((prev) => [payload.new as AppNotification, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchLatest]);

  const unreadCount = items.filter((i) => !i.read_at).length;

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read_at: new Date().toISOString() } : i)));
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (i.read_at ? i : { ...i, read_at: now })));
    await fetch("/api/notifications/mark-all-read", { method: "POST" }).catch(() => {});
  }, []);

  return { items, loaded, unreadCount, markRead, markAllRead, refetch: fetchLatest };
}
```

**Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Step 4: Commit**

```bash
git add src/hooks/use-notifications.ts
git commit -m "feat: add useNotifications client hook with Realtime subscription"
```

---

### Task 10: NotificationBell component

**Files:**
- Create: `src/components/layout/notification-bell.tsx`
- Modify: `src/components/layout/header.tsx:7` (remove unused `Bell` import if no longer used directly), `:273-277` (replace placeholder)

**Step 1: Write the component**

```tsx
"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTranslations } from "next-intl";
import { Bell, CheckCircle2, CalendarPlus, XCircle, Users, AlertTriangle } from "lucide-react";
import { useNotifications, type AppNotification } from "@/hooks/use-notifications";
import { useRouter } from "@/i18n/navigation";

const TYPE_ICON: Record<string, typeof Bell> = {
  checkin_submitted: CheckCircle2,
  reservation_created: CalendarPlus,
  reservation_cancelled: XCircle,
  duplicate_guest: Users,
  channel_sync_failed: AlertTriangle,
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function NotificationBell({ userId, orgSlug }: { userId: string; orgSlug: string }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const { items, unreadCount, markRead, markAllRead } = useNotifications(userId);

  const handleSelect = (n: AppNotification) => {
    markRead(n.id);
    if (n.link) router.push(`/${orgSlug}${n.link}`);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors relative"
          title={t("title")}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-96 max-h-[28rem] overflow-y-auto rounded-lg border border-border bg-surface shadow-lg"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-surface">
            <p className="text-sm font-semibold text-foreground">{t("title")}</p>
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="text-xs text-primary hover:underline disabled:opacity-40 disabled:no-underline"
            >
              {t("markAllRead")}
            </button>
          </div>
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
          )}
          {items.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Bell;
            return (
              <DropdownMenu.Item
                key={n.id}
                onSelect={() => handleSelect(n)}
                className={`flex items-start gap-3 px-4 py-3 text-sm cursor-pointer outline-none hover:bg-muted transition-colors border-b border-border last:border-0 ${
                  !n.read_at ? "bg-primary/5" : ""
                }`}
              >
                <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate">
                    {t(`types.${n.type}`, n.data as Record<string, string>)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(n.created_at)}</p>
                </div>
                {!n.read_at && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

**Step 2: Replace the placeholder in header.tsx**

Existing code (lines 273-277):
```tsx
        {/* Notifications */}
        <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
```

Replace with:
```tsx
        {/* Notifications */}
        <NotificationBell userId={user.id} orgSlug={org.slug} />
```

Add the import near the top of header.tsx:
```ts
import NotificationBell from "./notification-bell";
```

Check whether `Bell` is still used elsewhere in header.tsx after this change (it is not, based on the current file) — remove it from the `lucide-react` import on line 7 if so, to avoid an unused-import lint warning.

**Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Step 4: Commit**

```bash
git add src/components/layout/notification-bell.tsx src/components/layout/header.tsx
git commit -m "feat: replace placeholder bell with real NotificationBell dropdown"
```

---

### Task 11: i18n — en.json namespace

**Files:**
- Modify: `messages/en.json`

**Step 1: Add the `notifications` namespace**

Add near the end of the top-level object (matching the pattern of every prior Phase 16 namespace addition):

```json
"notifications": {
  "title": "Notifications",
  "markAllRead": "Mark all as read",
  "empty": "No notifications yet",
  "types": {
    "checkin_submitted": "{guestName} submitted online check-in ({reservationNumber})",
    "reservation_created": "New reservation for {guestName} ({reservationNumber})",
    "reservation_cancelled": "Reservation cancelled for {guestName} ({reservationNumber})",
    "duplicate_guest": "Possible duplicate guest: {guestName} ({documentNumber})",
    "channel_sync_failed": "{channelName} sync failed: {reason}"
  }
}
```

**Step 2: Verify the JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8'))"`
Expected: no output (no error thrown).

**Step 3: Commit**

```bash
git add messages/en.json
git commit -m "feat: add notifications i18n namespace to en.json"
```

---

### Task 12: i18n — remaining 10 locales

**Files:**
- Modify: `messages/{zh,hi,es,fr,ar,bn,pt,ru,ja,sr}.json`

**Step 1: Write a translation script**

Follow the exact pattern used for every prior Phase 16 stage (see `docs/phases/PHASE_16_PLAN.md` for the reference pattern, or any `add-*-ns.js` script from that phase if still present in the scratch history) — a Node script with one `data` object per locale, each containing the same 5 `types.*` keys plus `title`/`markAllRead`/`empty`, translated. Write it to the scratchpad directory, not the repo. Merge into each `messages/{locale}.json` via `JSON.parse` → assign `json.notifications = ...` → `JSON.stringify(json, null, 2) + "\n"`.

Note: Arabic needs `{count}`-style ICU plurals only if any string uses a count — none of these do, so plain `{param}` substitution is enough for all 11 languages here (no plural forms needed, unlike `documentCount` in a previous stage).

**Step 2: Run the script**

Run: `node <script-path>`
Expected: 10 lines of `wrote <locale>.json`.

**Step 3: Verify key-set parity**

Write and run the same flatten-and-diff verification script used in every prior Phase 16 stage, comparing all 10 locale files' full key sets against `en.json`.
Expected: `ALL LOCALES MATCH en.json`.

**Step 4: Commit**

```bash
git add messages/zh.json messages/hi.json messages/es.json messages/fr.json messages/ar.json messages/bn.json messages/pt.json messages/ru.json messages/ja.json messages/sr.json
git commit -m "feat: translate notifications namespace into all 10 non-English locales"
```

---

### Task 13: Final verification + build

**Files:** none (verification only)

**Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

**Step 2: Build**

Run: `npm run build` (background it if the system is slow — see the orphaned-process gotcha noted in `phase16_i18n_plan.md` memory if it hangs unusually long).
Expected: exit 0, all pages generate including the new `/api/notifications/*` routes.

**Step 3: Supabase advisors, one more time**

Run `mcp__supabase__get_advisors` (type: security) after all routes exist, to catch anything the earlier check missed once real traffic patterns (inserts via service role, reads via anon+RLS) are all wired up.

**Step 4: Commit (only if any fixups were needed)**

If Steps 1-3 were clean, nothing to commit here — this task is a checkpoint, not necessarily a new commit.

---

### Task 14: Manual smoke test (not automatable — auth-gated dashboard)

**Files:** none

**Step 1: Ask the user to verify live, in their own logged-in browser session:**

1. Submit a guest check-in via the guest-portal check-in link → bell badge should increment without a page refresh.
2. Create a new reservation as staff A, logged in as staff B in a second tab/session → staff B's badge should update live (proves the Realtime filter + fan-out insert both work, not just the initial fetch).
3. Cancel a reservation → notification appears, clicking it navigates to `/reservations` and marks it read.
4. Trigger a duplicate guest (create a guest with a document number that already exists) → notification appears for other staff, not for the staff member who triggered it.
5. Force a channel sync failure (e.g. temporarily break a channel's iCal URL) → notification appears, links to `/channels`.
6. Click "Mark all as read" → badge clears, all rows lose their unread styling.
7. Switch language via the existing globe switcher → reopen the bell dropdown → notification text should now render in the new language (proves the `t(`types.${type}`, data)` render-time translation, not baked-in text).

**Step 2: Report back**

If anything in Step 1 doesn't work as described, that's a bug to fix before considering Phase 17 done — this is the only verification step in the whole plan that isn't already covered by build/typecheck, so treat it as load-bearing, not optional.
