// Channex ARI outbox. PMS save-handlers ENQUEUE a change here (cheap insert,
// no API call); a worker batches pending rows per (org, kind) into single
// availability / restrictions pushes, rate-limited and with retry/backoff.
// This is the queue + limiter certification requires, and keeps pushes as
// deltas (each row scopes a date window + optional room types).

import type { SupabaseClient } from "@supabase/supabase-js";
import { pushAvailabilityForOrg } from "./channex-availability";
import { pushRatesForOrg } from "./channex-rates";
import { ChannexError } from "./channex";

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
  roomTypeIds?: string[]
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
  });
}

/** Enqueue an availability delta (e.g. after a booking create/cancel/move). */
export function enqueueAvailability(supabase: SupabaseClient, orgId: string, from?: string, to?: string, roomTypeIds?: string[]) {
  return enqueue(supabase, orgId, "availability", from, to, roomTypeIds);
}

/** Enqueue a rate/restriction delta (e.g. after a base_price change). */
export function enqueueRestrictions(supabase: SupabaseClient, orgId: string, from?: string, to?: string, roomTypeIds?: string[]) {
  return enqueue(supabase, orgId, "restrictions", from, to, roomTypeIds);
}

export interface OutboxResult {
  processed: number;
  sent: number;
  retried: number;
  errored: number;
  calls: number;
  rateLimited: boolean;
}

interface Group {
  orgId: string;
  kind: OutboxKind;
  from: string;
  to: string;
  rtIds: Set<string> | null; // null = all provisioned room types
  ids: string[];
  attempts: number;
}

// Worker: coalesce due rows per (org, kind), push once each, rate-limited.
// MAX_CALLS keeps us under the 20 ARI/min ceiling per invocation (a ~1-min
// cron makes that a real per-minute limit); leftover groups stay pending.
export async function processOutbox(supabase: SupabaseClient, maxCalls = 18): Promise<OutboxResult> {
  const nowIso = new Date().toISOString();
  const { data: due } = await supabase
    .from("channex_outbox")
    .select("id, organization_id, kind, from_date, to_date, room_type_ids, attempts")
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
      g = {
        orgId: row.organization_id,
        kind: row.kind,
        from: row.from_date,
        to: row.to_date,
        rtIds: row.room_type_ids ? new Set<string>(row.room_type_ids) : null,
        ids: [],
        attempts: 0,
      };
      groups.set(key, g);
    } else {
      if (row.from_date < g.from) g.from = row.from_date;
      if (row.to_date > g.to) g.to = row.to_date;
      // A "null = all room types" row widens the group to all.
      if (g.rtIds === null || row.room_type_ids === null) g.rtIds = null;
      else for (const id of row.room_type_ids) g.rtIds.add(id);
    }
    g.ids.push(row.id);
    g.attempts = Math.max(g.attempts, row.attempts ?? 0);
  }

  let sent = 0, retried = 0, errored = 0, calls = 0, rateLimited = false;

  for (const g of groups.values()) {
    if (calls >= maxCalls) { rateLimited = true; break; }
    const rtIds = g.rtIds ? [...g.rtIds] : undefined;
    try {
      if (g.kind === "availability") {
        await pushAvailabilityForOrg(supabase, g.orgId, { from: g.from, to: g.to, roomTypeLocalIds: rtIds });
      } else {
        await pushRatesForOrg(supabase, g.orgId, { from: g.from, to: g.to, roomTypeLocalIds: rtIds });
      }
      calls++;
      await supabase.from("channex_outbox").update({ status: "sent", sent_at: new Date().toISOString() }).in("id", g.ids);
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

  return { processed: rows.length, sent, retried, errored, calls, rateLimited };
}
