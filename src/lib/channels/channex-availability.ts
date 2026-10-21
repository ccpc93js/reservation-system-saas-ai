// Channex Phase 4 — availability (ARI) push. Computes free beds per room type
// per night from the PMS (the source of truth) and pushes them to Channex so
// OTAs stop overselling. Run-length compressed (consecutive equal-availability
// dates become one range) to keep payloads small. Never sends past dates.
//
// Used two ways:
//   - scoped: after an inbound booking create/cancel, push just that room
//     type's affected date window (fast decrement/restore).
//   - full: a periodic reconcile over a long horizon for the whole property
//     (drift correction; also the manual "Sync availability" action).

import type { SupabaseClient } from "@supabase/supabase-js";
import { channex, type AvailabilityValue } from "./channex";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface RangeRow {
  room_type_id: string;
  date_from: string;
  date_to: string;
  free: number;
}

export interface PushAvailabilityOptions {
  from?: string; // inclusive, ISO. Clamped to today.
  to?: string; // exclusive, ISO. Defaults to from + horizonDays.
  horizonDays?: number; // used when `to` is omitted (default 365).
  roomTypeLocalIds?: string[]; // limit to these local room types (scoped push).
}

export interface PushAvailabilityResult {
  ok: boolean;
  propertyId: string | null;
  roomTypesPushed: number;
  entries: number;
  skipped?: string;
  // Task id(s) Channex's response carries back — certification asks for these.
  channexTaskIds?: string[];
}

export async function pushAvailabilityForOrg(
  supabase: SupabaseClient,
  orgId: string,
  opts: PushAvailabilityOptions = {}
): Promise<PushAvailabilityResult> {
  // Resolve provisioned ids: property + room type map (local -> channex).
  const { data: links } = await supabase
    .from("channel_provider_links")
    .select("kind, local_id, channex_id")
    .eq("organization_id", orgId)
    .in("kind", ["property", "room_type"]);

  const rows = (links as { kind: string; local_id: string; channex_id: string }[]) ?? [];
  const property = rows.find((r) => r.kind === "property");
  if (!property) return { ok: false, propertyId: null, roomTypesPushed: 0, entries: 0, skipped: "org not provisioned" };
  const propertyId = property.channex_id;

  const rtMap = new Map<string, string>(); // local room_type id -> channex id
  for (const r of rows) if (r.kind === "room_type") rtMap.set(r.local_id, r.channex_id);
  if (rtMap.size === 0) return { ok: false, propertyId, roomTypesPushed: 0, entries: 0, skipped: "no mapped room types" };

  // Date window — never before today.
  const from = opts.from && opts.from > todayISO() ? opts.from : todayISO();
  const to = opts.to ?? addDaysISO(from, opts.horizonDays ?? 365);
  if (to <= from) return { ok: true, propertyId, roomTypesPushed: 0, entries: 0, skipped: "empty window" };

  // Availability as SQL-compressed ranges (few rows — no PostgREST 1000 cap).
  const { data: ranges, error } = await supabase.rpc("free_beds_ranges", {
    p_organization_id: orgId,
    p_from: from,
    p_to: to,
  });
  if (error) return { ok: false, propertyId, roomTypesPushed: 0, entries: 0, skipped: error.message };

  const filter = opts.roomTypeLocalIds ? new Set(opts.roomTypeLocalIds) : null;
  const values: AvailabilityValue[] = [];
  const roomTypeSet = new Set<string>();
  for (const row of (ranges as RangeRow[]) ?? []) {
    if (filter && !filter.has(row.room_type_id)) continue;
    const channexId = rtMap.get(row.room_type_id);
    if (!channexId) continue; // unprovisioned room type
    values.push({
      property_id: propertyId,
      room_type_id: channexId,
      date_from: row.date_from,
      date_to: row.date_to,
      availability: row.free,
    });
    roomTypeSet.add(row.room_type_id);
  }
  const roomTypesPushed = roomTypeSet.size;

  if (values.length === 0) return { ok: true, propertyId, roomTypesPushed: 0, entries: 0, skipped: "nothing to push" };

  const response = await channex.pushAvailability(values);
  const channexTaskIds = Array.isArray(response)
    ? response.map((r: any) => r?.id).filter((id: unknown): id is string => typeof id === "string")
    : undefined;
  return { ok: true, propertyId, roomTypesPushed, entries: values.length, channexTaskIds };
}

// One independently-scoped slice of a batched push: its own date window and
// its own room-type filter. Mirrors one outbox row.
export interface AvailabilityScope {
  from: string;
  to: string; // exclusive
  roomTypeLocalIds?: string[]; // local room_types.id values; undefined = all mapped room types
}

// Like pushAvailabilityForOrg, but takes several independent scopes and
// sends them all as ONE /availability call instead of one call per scope —
// each scope's own date window queried on its own, never widened to cover
// another scope's dates. Without this, coalescing e.g. a Twin-Room delta for
// 10–16 Nov with a Double-Room delta for 17–24 Nov into one flat union
// window (10–24 Nov, both room types) pushes each room type's real
// availability across the OTHER room type's dates too — correct values,
// wrong coverage, which is exactly what certification flagged ("Twin Room:
// covers 2026-11-10..2026-11-24, expected 2026-11-10..2026-11-16").
export async function pushAvailabilityForOrgScoped(
  supabase: SupabaseClient,
  orgId: string,
  scopes: AvailabilityScope[]
): Promise<PushAvailabilityResult> {
  if (scopes.length === 0) return { ok: true, propertyId: null, roomTypesPushed: 0, entries: 0, skipped: "no scopes" };

  const { data: links } = await supabase
    .from("channel_provider_links")
    .select("kind, local_id, channex_id")
    .eq("organization_id", orgId)
    .in("kind", ["property", "room_type"]);

  const rows = (links as { kind: string; local_id: string; channex_id: string }[]) ?? [];
  const property = rows.find((r) => r.kind === "property");
  if (!property) return { ok: false, propertyId: null, roomTypesPushed: 0, entries: 0, skipped: "org not provisioned" };
  const propertyId = property.channex_id;

  const rtMap = new Map<string, string>();
  for (const r of rows) if (r.kind === "room_type") rtMap.set(r.local_id, r.channex_id);
  if (rtMap.size === 0) return { ok: false, propertyId, roomTypesPushed: 0, entries: 0, skipped: "no mapped room types" };

  const today = todayISO();
  const normalized = scopes
    .map((s) => {
      const from = s.from > today ? s.from : today;
      if (s.to <= from) return null;
      return { from, to: s.to, filter: s.roomTypeLocalIds ? new Set(s.roomTypeLocalIds) : null };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  if (normalized.length === 0) return { ok: true, propertyId, roomTypesPushed: 0, entries: 0, skipped: "empty window" };

  const values: AvailabilityValue[] = [];
  const roomTypeSet = new Set<string>();

  for (const s of normalized) {
    const { data: ranges, error } = await supabase.rpc("free_beds_ranges", {
      p_organization_id: orgId,
      p_from: s.from,
      p_to: s.to,
    });
    if (error) return { ok: false, propertyId, roomTypesPushed: 0, entries: 0, skipped: error.message };

    for (const row of (ranges as RangeRow[]) ?? []) {
      if (s.filter && !s.filter.has(row.room_type_id)) continue;
      const channexId = rtMap.get(row.room_type_id);
      if (!channexId) continue;
      values.push({
        property_id: propertyId,
        room_type_id: channexId,
        date_from: row.date_from,
        date_to: row.date_to,
        availability: row.free,
      });
      roomTypeSet.add(row.room_type_id);
    }
  }

  if (values.length === 0) return { ok: true, propertyId, roomTypesPushed: 0, entries: 0, skipped: "nothing to push" };

  const response = await channex.pushAvailability(values);
  const channexTaskIds = Array.isArray(response)
    ? response.map((r: any) => r?.id).filter((id: unknown): id is string => typeof id === "string")
    : undefined;
  return { ok: true, propertyId, roomTypesPushed: roomTypeSet.size, entries: values.length, channexTaskIds };
}
