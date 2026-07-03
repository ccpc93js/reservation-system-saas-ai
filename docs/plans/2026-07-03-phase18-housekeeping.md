# Phase 18 Housekeeping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-bed housekeeping status (Clean/Dirty/Inspected/Out-of-Order) with a dedicated staff board, auto-dirty on checkout, and non-blocking warnings in the booking flow.

**Architecture:** 3 new columns directly on the existing `beds` table (no new table), a fire-and-forget update in the checkout route, a manual-change API route, a Realtime-backed client hook mirroring Phase 17's `useNotifications`, and a new `/housekeeping` page grouped by room.

**Tech Stack:** Next.js 15 (App Router), Supabase (Postgres + RLS + Realtime), next-intl, TypeScript.

**Full design rationale:** `docs/phases/PHASE_18_PLAN.md` — read this first for the Decision Log if anything below is ambiguous.

**No test framework in this repo.** Every task's "verify" step uses `npx tsc --noEmit`, the i18n verification scripts, `npm run build`, and/or `mcp__supabase__get_advisors` — not unit tests.

---

### Task 1: Database migration

**Files:** none local — applied via `mcp__supabase__apply_migration`, name it `add_housekeeping_status_to_beds`.

**Step 1: Apply the migration**

```sql
alter table beds
  add column housekeeping_status text not null default 'clean'
    check (housekeeping_status in ('clean', 'dirty', 'inspected', 'out_of_order')),
  add column housekeeping_updated_at timestamptz not null default now(),
  add column housekeeping_updated_by uuid references auth.users(id);

alter publication supabase_realtime add table beds;
```

**Step 2: Verify**

Run `mcp__supabase__list_tables` — confirm `beds` now has the 3 new columns with the check constraint. Run `mcp__supabase__get_advisors` (type: security) — confirm nothing new is flagged for `beds` (existing RLS policies already cover new columns on the same row, so nothing should change).

**Step 3: Regenerate TypeScript types**

Run `mcp__supabase__generate_typescript_types`. Write the output to `src/lib/types/database.ts`, replacing its content, then **manually re-append the hand-maintained convenience type aliases and Document Types section** that the raw generator output doesn't include (`Organization`, `Membership`, `RoomType`, `Room`, `Bed`, `Guest`, `Reservation`, `ReservationItem`, `ScanSession`, `Channel`, `Invitation`, `CheckinRegistryEntry`, `AuditLogEntry`, `Notification`, plus `DocumentMetadata`/`UploadDocumentResponse` interfaces) — copy these verbatim from the current file's tail before overwriting, since the Write tool replaces the whole file. Keep the file's existing header comment explaining why this regeneration convention exists.

**Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (There may be *existing* errors if other in-flight work touches `Bed` — if so, confirm they're pre-existing and unrelated before proceeding, don't fix unrelated issues here.)

**Step 5: Commit**

```bash
git add src/lib/types/database.ts
git commit -m "feat: add housekeeping_status columns to beds table"
```

---

### Task 2: Auto-dirty on checkout

**Files:**
- Modify: `src/app/api/reservations/[id]/checkout/route.ts`

**Step 1: Read the full file first**

The checkout route currently updates `reservations.status` to `checked_out`, then sends a confirmation email. Read the whole file to find the exact spot after the reservation-status update succeeds and before the email-send block.

**Step 2: Add the bed-dirtying logic**

Insert this right after the `if (updateError) { ... }` check that follows the reservation status update, and before the "Send checkout confirmation email" comment:

```ts
// Mark bed(s) dirty for housekeeping — never blocks checkout if this fails
const { data: items } = await supabase
  .from("reservation_items")
  .select("bed_id")
  .eq("reservation_id", id);

if (items?.length) {
  await supabase
    .from("beds")
    .update({
      housekeeping_status: "dirty",
      housekeeping_updated_at: new Date().toISOString(),
      housekeeping_updated_by: null,
    })
    .in("id", items.map((i) => i.bed_id))
    .neq("housekeeping_status", "out_of_order")
    .then(({ error }) => {
      if (error) console.error("Failed to mark bed dirty on checkout:", error);
    });
}
```

Use `.then()` with inline error logging (not `await` + `if (error)`) only if that's awkward given the surrounding code style — otherwise prefer the same `const { error } = await ...; if (error) console.error(...)` pattern used elsewhere in this file for consistency. Check the file's existing style before choosing.

**Important:** this must never throw or return an error response — if the bed update fails, checkout still succeeds. Wrap in a try/catch if the surrounding code isn't already inside one broad try/catch (check — the whole route handler likely already has one outer try/catch, in which case an uncaught error here would still be swallowed by that outer catch and turned into a 500, which would be WRONG since checkout itself already succeeded by this point). If there's an outer try/catch that could turn a bed-update failure into a false "checkout failed" 500 response, this specific block needs its OWN inner try/catch that only logs, so a bed-update failure can never override the success response.

**Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Step 4: Commit**

```bash
git add "src/app/api/reservations/[id]/checkout/route.ts"
git commit -m "feat: auto-mark bed dirty on guest checkout"
```

---

### Task 3: Manual status-change API route

**Files:**
- Create: `src/app/api/beds/[id]/housekeeping/route.ts`

**Step 1: Write the route**

```ts
import { createServerClient } from "@/lib/supabase/server";

const VALID_STATUSES = ["clean", "dirty", "inspected", "out_of_order"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { status } = body;

  if (!VALID_STATUSES.includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error } = await supabase
    .from("beds")
    .update({
      housekeeping_status: status,
      housekeeping_updated_at: new Date().toISOString(),
      housekeeping_updated_by: user.id,
    })
    .eq("id", id);

  if (error) return Response.json({ error: "Failed to update status" }, { status: 400 });
  return Response.json({ success: true });
}
```

Look at `src/app/api/reservations/[id]/cancel/route.ts` first for the established async-params + auth-check pattern in this codebase, and confirm this matches it.

**Step 2: Typecheck**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/api/beds
git commit -m "feat: add manual housekeeping status API route"
```

---

### Task 4: useHousekeeping client hook

**Files:**
- Create: `src/lib/hooks/use-housekeeping.ts` (following the Phase 17 precedent — `src/hooks/` is not a real convention in this codebase; confirm this is still true by checking `src/lib/hooks/use-notifications.ts` exists before assuming the location)

**Step 1: Write the hook**

```ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export interface HousekeepingBed {
  id: string;
  name: string;
  position: number | null;
  housekeeping_status: string;
  housekeeping_updated_at: string;
  rooms: {
    id: string;
    name: string;
    room_types: { name: string; type: string } | null;
  } | null;
}

export function useHousekeeping(orgId: string) {
  const [beds, setBeds] = useState<HousekeepingBed[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchBeds = useCallback(async () => {
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from("beds")
      .select("id, name, position, housekeeping_status, housekeeping_updated_at, rooms(id, name, room_types(name, type))")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("position");
    setBeds((data as unknown as HousekeepingBed[]) ?? []);
    setLoaded(true);
  }, [orgId]);

  useEffect(() => {
    fetchBeds();

    const supabase = createBrowserClient();
    const channel = supabase
      .channel("housekeeping-org")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "beds", filter: `organization_id=eq.${orgId}` },
        (payload) => {
          setBeds((prev) =>
            prev.map((b) => (b.id === payload.new.id ? { ...b, ...(payload.new as Partial<HousekeepingBed>) } : b))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, fetchBeds]);

  const updateStatus = useCallback(async (bedId: string, status: string) => {
    setBeds((prev) =>
      prev.map((b) => (b.id === bedId ? { ...b, housekeeping_status: status, housekeeping_updated_at: new Date().toISOString() } : b))
    );
    await fetch(`/api/beds/${bedId}/housekeeping`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  }, []);

  return { beds, loaded, updateStatus, refetch: fetchBeds };
}
```

Note the Realtime payload merge (`{ ...b, ...(payload.new as ...) }`) only spreads known housekeeping fields on top of the existing joined `rooms` data — `payload.new` from a `postgres_changes` event is the raw `beds` row and does NOT include the `rooms` join, so a naive full replace would wipe out the room/type info already in state. Verify this reasoning holds and adjust if the actual Realtime payload behaves differently than assumed (check Supabase Realtime docs behavior, or just trust that partial-merge is safe either way since it only overwrites housekeeping_* fields plus id/name/position which are also on the base row).

**Step 2: Typecheck**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/hooks/use-housekeeping.ts
git commit -m "feat: add useHousekeeping client hook with Realtime subscription"
```

---

### Task 5: Housekeeping page + client component

**Files:**
- Create: `src/app/[locale]/[slug]/housekeeping/page.tsx`
- Create: `src/components/housekeeping/housekeeping-client.tsx`

**Step 1: Write the server page**

Model this on `src/app/[locale]/[slug]/rooms/page.tsx` (read it first) for the auth/membership-lookup boilerplate, but simpler — this page doesn't need pagination, just passes `orgId` to the client component since the hook does its own fetching:

```tsx
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase/server";
import HousekeepingClient from "@/components/housekeeping/housekeeping-client";

type Membership = { organization_id: string };

export default async function HousekeepingPage() {
  const supabase = await createServerClient();
  const t = await getTranslations("housekeeping");

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return <div className="text-sm text-muted-foreground">{t("unauthorized")}</div>;
  }

  const { data: membershipRaw } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  const membership = membershipRaw as Membership | null;
  if (!membership) {
    return <div className="text-sm text-muted-foreground">{t("noOrgFound")}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm mt-0.5 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <HousekeepingClient orgId={membership.organization_id} />
    </div>
  );
}
```

**Step 2: Write the client component**

```tsx
"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useHousekeeping, type HousekeepingBed } from "@/lib/hooks/use-housekeeping";

const STATUS_COLORS: Record<string, string> = {
  clean: "bg-emerald-100 text-emerald-700 border-emerald-200",
  dirty: "bg-amber-100 text-amber-700 border-amber-200",
  inspected: "bg-blue-100 text-blue-700 border-blue-200",
  out_of_order: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_VALUES = ["clean", "dirty", "inspected", "out_of_order"] as const;

export default function HousekeepingClient({ orgId }: { orgId: string }) {
  const t = useTranslations("housekeeping");
  const { beds, loaded, updateStatus } = useHousekeeping(orgId);
  const [filter, setFilter] = useState<"all" | "dirty" | "out_of_order">("all");

  const filteredBeds = useMemo(() => {
    if (filter === "all") return beds;
    return beds.filter((b) => b.housekeeping_status === filter);
  }, [beds, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { roomName: string; beds: HousekeepingBed[] }>();
    for (const bed of filteredBeds) {
      const roomId = bed.rooms?.id ?? "unassigned";
      const roomName = bed.rooms?.name ?? t("noRoom");
      if (!map.has(roomId)) map.set(roomId, { roomName, beds: [] });
      map.get(roomId)!.beds.push(bed);
    }
    return Array.from(map.values());
  }, [filteredBeds, t]);

  if (!loaded) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["all", "dirty", "out_of_order"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-surface text-foreground border-border hover:bg-muted"
            }`}
          >
            {t(`filter_${f}`)}
          </button>
        ))}
      </div>

      {grouped.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">{t("empty")}</p>
      )}

      {grouped.map((group) => (
        <div key={group.roomName} className="bg-surface rounded-xl border border-border shadow-sm p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">{group.roomName}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {group.beds.map((bed) => (
              <div key={bed.id} className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-sm font-medium text-foreground truncate">{bed.name}</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[bed.housekeeping_status]}`}>
                  {t(`status_${bed.housekeeping_status}`)}
                </span>
                <div className="flex flex-wrap gap-1">
                  {STATUS_VALUES.filter((s) => s !== bed.housekeeping_status).map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(bed.id, s)}
                      className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
                    >
                      {t(`status_${s}`)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Typecheck**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add "src/app/[locale]/[slug]/housekeeping" src/components/housekeeping
git commit -m "feat: add housekeeping board page"
```

---

### Task 6: Sidebar nav + header page title

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/header.tsx`

**Step 1: Add the nav entry to sidebar.tsx**

Read the file first. Add a new icon import (`Sparkles` from `lucide-react` — check it's not already imported under a different alias) and add an entry to `mainNavRoutes`, positioned after `rooms` (matches this Phase's design doc: "between Rooms and Channels" — but since `channels` is currently listed *before* `guests`/`rooms` in the actual array order shown during investigation, place it at the end of `mainNavRoutes`, right after the `rooms` entry, which is the last item — re-verify actual current array order before deciding position, don't assume the design doc's prose order matches the real array):

```ts
{ path: "housekeeping", labelKey: "housekeeping", icon: Sparkles },
```

**Step 2: Add the header pageTitles entry**

In `header.tsx`, find the `pageTitles` object (a `Record<string, string>` mapping route segments to translated titles) and add:

```ts
"/housekeeping": t("pageTitles.housekeeping"),
```

**Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: this WILL fail until Task 8 adds the `sidebar.nav.housekeeping` and `header.pageTitles.housekeeping` keys, UNLESS this project doesn't statically validate message keys (confirmed true in Phase 17 — no `IntlMessages` type augmentation exists). Confirm this is still the case; if so, `tsc` should pass even with the keys missing (they'll just render as raw keys at runtime until Task 8, same as Phase 17's Task 10).

**Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx src/components/layout/header.tsx
git commit -m "feat: add housekeeping nav entry and page title"
```

---

### Task 7: Warning badge in tape chart

**Files:**
- Modify: `src/app/[locale]/[slug]/calendar/page.tsx` (add `housekeeping_status` to the beds select)
- Modify: `src/components/calendar/tape-chart.tsx` (add to `Bed` interface, render warning icon)

**Step 1: Add the column to the server-side select**

In `calendar/page.tsx`, find the beds query (`select` with `id, name, position, rooms(...)`) and add `housekeeping_status`:

```ts
.select(
  `
  id, name, position, housekeeping_status,
  rooms(id, name,
    room_types(id, name, type)
  )
`
)
```

**Step 2: Add the field to tape-chart.tsx's Bed interface**

```ts
interface Bed {
  id: string;
  name: string;
  position: number | null;
  housekeeping_status?: string;
  rooms: {
    id: string;
    name: string;
    room_types: { id: string; name: string; type: string } | null;
  } | null;
}
```

Optional (`?`) since other callers of this component might not always pass it — check if `TapeChartProps.beds` is used anywhere besides the calendar page before deciding whether to make it required; if calendar/page.tsx is the only source, it can be required instead.

**Step 3: Render a warning icon next to the bed name**

Read the bed-row rendering code (around where `bed.name` is displayed in a `<span>`) and add a conditional icon import (`AlertTriangle` from `lucide-react`, check it's not already imported) right after the name span, shown only when `housekeeping_status` is `"dirty"` or `"out_of_order"`:

```tsx
<span className="text-xs font-medium text-slate-900 truncate pr-2">{bed.name}</span>
{(bed.housekeeping_status === "dirty" || bed.housekeeping_status === "out_of_order") && (
  <AlertTriangle
    className="w-3 h-3 text-amber-500 shrink-0"
    aria-label={t(`housekeepingWarning_${bed.housekeeping_status}`)}
  />
)}
```

Check what translation namespace `t` refers to in this component (likely `"calendar"`, confirm by reading the `useTranslations` call near the top) — the new keys (`housekeepingWarning_dirty`, `housekeepingWarning_out_of_order`) go in that same namespace in Task 8, not in `housekeeping`.

**Step 4: Typecheck**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add "src/app/[locale]/[slug]/calendar/page.tsx" src/components/calendar/tape-chart.tsx
git commit -m "feat: show housekeeping warning badge on tape chart bed rows"
```

---

### Task 8: i18n — en.json

**Files:**
- Modify: `messages/en.json`

**Step 1: Add the `housekeeping` namespace**

```json
"housekeeping": {
  "title": "Housekeeping",
  "subtitle": "Track cleaning status across all beds",
  "unauthorized": "You must be signed in to view this page.",
  "noOrgFound": "No organization found for your account.",
  "loading": "Loading...",
  "empty": "No beds match this filter.",
  "noRoom": "Unassigned",
  "filter_all": "All",
  "filter_dirty": "Dirty",
  "filter_out_of_order": "Out of Order",
  "status_clean": "Clean",
  "status_dirty": "Dirty",
  "status_inspected": "Inspected",
  "status_out_of_order": "Out of Order"
}
```

**Step 2: Add the sidebar and header keys**

In the existing `sidebar.nav` object, add: `"housekeeping": "Housekeeping"`.
In the existing `header.pageTitles` object, add: `"housekeeping": "Housekeeping"`.

**Step 3: Add the tape-chart warning keys**

In whichever namespace `tape-chart.tsx` actually uses (confirmed in Task 7 Step 3 — likely `calendar`), add:

```json
"housekeepingWarning_dirty": "This bed needs cleaning",
"housekeepingWarning_out_of_order": "This bed is out of order"
```

**Step 4: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8'))"`
Expected: no output.

**Step 5: Commit**

```bash
git add messages/en.json
git commit -m "feat: add housekeeping i18n keys to en.json"
```

---

### Task 9: i18n — remaining 10 locales

**Files:**
- Modify: `messages/{zh,hi,es,fr,ar,bn,pt,ru,ja,sr}.json`

**Step 1: Write and run a translation script**

Same pattern as every Phase 16/17 stage — a Node script in the scratchpad directory with one `data` object per locale covering all keys added in Task 8 (the `housekeeping` namespace, the 2 `sidebar.nav`/`header.pageTitles` keys, and the 2 tape-chart warning keys), merged into each `messages/{locale}.json`.

**Step 2: Verify key-set parity**

Run the flatten-and-diff verification script (same one used in every prior i18n stage) comparing all 10 locale files against `en.json`.
Expected: `ALL LOCALES MATCH en.json`.

**Step 3: Commit**

```bash
git add messages/zh.json messages/hi.json messages/es.json messages/fr.json messages/ar.json messages/bn.json messages/pt.json messages/ru.json messages/ja.json messages/sr.json
git commit -m "feat: translate housekeeping namespace into all 10 non-English locales"
```

---

### Task 10: Final verification + build

**Files:** none (verification only)

**Step 1: Typecheck**

Run: `npx tsc --noEmit` — expect zero errors.

**Step 2: Build**

Run: `npm run build` (background it; watch for the known orphaned-node-process hang pattern documented in the `phase16_i18n_plan` memory — check `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` for stray `next dev`/`next build` processes if it hangs unusually long).
Expected: exit 0, all pages generate including `/[locale]/[slug]/housekeeping` and `/api/beds/[id]/housekeeping`.

**Step 3: Supabase advisors**

Run `mcp__supabase__get_advisors` (type: security) once more — confirm nothing new is flagged.

---

### Task 11: Manual smoke test (not automatable — auth-gated dashboard + Realtime)

**Files:** none

**Step 1: Ask the user to verify live, in their own logged-in browser session:**

1. Open `/housekeeping` — beds render grouped by room, all showing "Clean" (existing beds default there).
2. Click a status button on one bed → it updates immediately in this tab.
3. Open a second tab/session as a different staff member → confirm the same bed shows the updated status without refreshing (Realtime).
4. Check a guest out of a reservation → the bed used for that reservation should now show "Dirty" on the housekeeping board.
5. Mark a bed "Out of Order", then check a *different* guest out of a reservation using a *different* bed — confirm the out-of-order bed is untouched (didn't get reset to dirty).
6. Open the calendar/tape chart → a bed marked Dirty or Out of Order should show a small warning icon next to its name; a Clean/Inspected bed should not.
7. Confirm booking a guest into a bed showing the warning icon still works (not blocked).
8. Switch language via the globe switcher → reopen `/housekeeping` → status labels and page title should render in the new language.

**Step 2: Report back**

If anything in Step 1 doesn't work as described, that's a bug to fix before considering Phase 18 done.
