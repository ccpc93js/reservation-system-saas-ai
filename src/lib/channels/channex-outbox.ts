// Channex ARI outbox. PMS save-handlers ENQUEUE a change here (cheap insert,
// no API call); a worker batches pending rows per (org, kind) into single
// availability / restrictions pushes, rate-limited and with retry/backoff.
// This is the queue + limiter certification requires, and keeps pushes as
// deltas (each row scopes a date window + optional room types).

import type { SupabaseClient } from "@supabase/supabase-js";
import { pushAvailabilityForOrgScoped, type AvailabilityScope } from "./channex-availability";
import { pushRatesForOrgScoped, type RateScope } from "./channex-rates";
import { ChannexError, OVERRIDE_FIELD_KEYS, type OverrideFieldKey } from "./channex";

type OutboxKind = "availability" | "restrictions";

async function isProvisioned(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const { data } = await supabase
    .from("channel_provider_links")
    .select("id")
    .eq("organization_id", orgId)
    .eq("kind", "property")
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function enqueue(
  supabase: SupabaseClient,
  orgId: string,
  kind: OutboxKind,
  from?: string,
  to?: string,
  roomTypeIds?: string[],
  touchedFields?: string[]
): Promise<void> {
  if (!from || !to) return;
  // Skip orgs that aren't connected to Channex — no junk rows for iCal-only or
  // unprovisioned tenants.
  if (!(await isProvisioned(supabase, orgId))) return;
  await supabase.from("channex_outbox").insert({
    organization_id: orgId,
    kind,
    from_date: from,
    to_date: to,
    room_type_ids: roomTypeIds && roomTypeIds.length ? roomTypeIds : null,
    ...(touchedFields && touchedFields.length ? { touched_fields: touchedFields } : {}),
  });
}

/** Enqueue an availability delta (e.g. after a booking create/cancel/move). */
export function enqueueAvailability(supabase: SupabaseClient, orgId: string, from?: string, to?: string, roomTypeIds?: string[]) {
  return enqueue(supabase, orgId, "availability", from, to, roomTypeIds);
}

/** Enqueue a rate/restriction delta (e.g. after a base_price change). roomTypeIds here holds rate_plan ids. */
export function enqueueRestrictions(supabase: SupabaseClient, orgId: string, from?: string, to?: string, roomTypeIds?: string[], touchedFields?: string[]) {
  return enqueue(supabase, orgId, "restrictions", from, to, roomTypeIds, touchedFields);
}

export interface OutboxResult {
  processed: number;
  sent: number;
  retried: number;
  errored: number;
  calls: number;
  rateLimited: boolean;
  // Task id(s) Channex's response carries back for each group actually
  // pushed this invocation — certification asks for these.
  channexTaskIds: string[];
}

interface Group {
  orgId: string;
  kind: OutboxKind;
  ids: string[];
  attempts: number;
  // One entry per coalesced row, each keeping its own date range/room-or-
  // rate-plan filter/touched-fields — never unioned into one flat window.
  // See pushRatesForOrgScoped's and pushAvailabilityForOrgScoped's doc
  // comments for why. (AvailabilityScope is a subset of RateScope's shape,
  // so the same array serves both kinds — touchedFields is simply unused
  // when kind is "availability".)
  scopes: RateScope[];
}

// touched_fields is a plain text[] column with no CHECK constraint, so a row
// read back from the DB could in principle contain a stale/garbage value —
// drop anything that isn't a real OverrideFieldKey rather than trusting it.
function toOverrideFieldKeys(fields: string[] | null | undefined): Set<OverrideFieldKey> | null {
  if (!fields || fields.length === 0) return null;
  const valid = fields.filter((f): f is OverrideFieldKey => (OVERRIDE_FIELD_KEYS as readonly string[]).includes(f));
  return valid.length > 0 ? new Set(valid) : null;
}

// Worker: coalesce due rows per (org, kind), push once each, rate-limited.
// MAX_CALLS keeps us under the 20 ARI/min ceiling per invocation (a ~1-min
// cron makes that a real per-minute limit); leftover groups stay pending.
export async function processOutbox(supabase: SupabaseClient, maxCalls = 18): Promise<OutboxResult> {
  const nowIso = new Date().toISOString();
  const { data: due } = await supabase
    .from("channex_outbox")
    .select("id, organization_id, kind, from_date, to_date, room_type_ids, attempts, touched_fields")
    .eq("status", "pending")
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(500);

  const rows = (due as any[]) ?? [];
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const key = `${row.organization_id}:${row.kind}`;
    let g = groups.get(key);
    if (!g) {
      g = { orgId: row.organization_id, kind: row.kind, ids: [], attempts: 0, scopes: [] };
      groups.set(key, g);
    }
    g.scopes.push({
      from: row.from_date,
      to: row.to_date,
      roomTypeLocalIds: row.room_type_ids ?? undefined,
      touchedFields: toOverrideFieldKeys(row.touched_fields) ?? undefined,
    });
    g.ids.push(row.id);
    g.attempts = Math.max(g.attempts, row.attempts ?? 0);
  }

  let sent = 0, retried = 0, errored = 0, calls = 0, rateLimited = false;
  const channexTaskIds: string[] = [];

  for (const g of groups.values()) {
    if (calls >= maxCalls) { rateLimited = true; break; }
    try {
      const result = g.kind === "availability"
        ? await pushAvailabilityForOrgScoped(supabase, g.orgId, g.scopes as AvailabilityScope[])
        : await pushRatesForOrgScoped(supabase, g.orgId, g.scopes);
      if (result.channexTaskIds) channexTaskIds.push(...result.channexTaskIds);
      calls++;
      await supabase.from("channex_outbox").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        ...(result.channexTaskIds && result.channexTaskIds.length ? { task_ids: result.channexTaskIds } : {}),
      }).in("id", g.ids);
      sent += g.ids.length;
    } catch (err) {
      calls++; // a failed call still hit the API
      const status = err instanceof ChannexError ? err.status : 0;
      const transient = status === 429 || status >= 500 || status === 0;
      const attempts = g.attempts + 1;
      if (transient && attempts < 8) {
        // Exponential backoff, capped at 5 minutes.
        const backoffMs = Math.min(300_000, 15_000 * 2 ** (attempts - 1));
        await supabase.from("channex_outbox").update({
          attempts,
          next_attempt_at: new Date(Date.now() + backoffMs).toISOString(),
          last_error: err instanceof Error ? err.message : "error",
        }).in("id", g.ids);
        retried += g.ids.length;
      } else {
        // Permanent (4xx) or too many attempts — park as error for attention.
        await supabase.from("channex_outbox").update({
          status: "error",
          attempts,
          last_error: err instanceof Error ? err.message : "error",
        }).in("id", g.ids);
        errored += g.ids.length;
      }
    }
  }

  return { processed: rows.length, sent, retried, errored, calls, rateLimited, channexTaskIds };
}
