// Channex rate + restriction push. Reads each rate plan's standing defaults
// (rate, stop_sell, closed_to_arrival/departure, min_stay_arrival/through,
// max_stay) plus any per-date overrides in room_type_rate_overrides, computes
// the effective value per night, and run-length compresses consecutive
// nights with identical values into the fewest possible /restrictions
// entries. /restrictions is a partial update: a field omitted from an entry
// leaves whatever Channex already has for that date untouched rather than
// clearing it. When `touchedFields` is given (outbox-driven incremental
// pushes), only those fields are ever included — this is what makes an
// edit's Channex payload a sparse delta instead of a full snapshot. Omitted
// (full-sync callers), every field is included, same as before this mattered.
// Each local rate plan maps to exactly one Channex rate plan. Never sends
// past dates.

import type { SupabaseClient } from "@supabase/supabase-js";
import { channex, toChannexMinor, OVERRIDE_FIELD_KEYS, type RestrictionValue, type OverrideFieldKey } from "./channex";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface PushRatesOptions {
  from?: string; // inclusive, clamped to today
  to?: string; // exclusive (checkout-style); nights are [from, to)
  horizonDays?: number; // default 500 (certification full-sync horizon)
  roomTypeLocalIds?: string[]; // rate_plans.id values, despite the name (kept for outbox call-site symmetry with availability)
  touchedFields?: Set<OverrideFieldKey>; // omitted = every field (full sync)
}

export interface PushRatesResult {
  ok: boolean;
  propertyId: string | null;
  ratePlansPushed: number;
  entries: number;
  skipped?: string;
  channexTaskIds?: string[];
}

interface EffectiveValues {
  rate: number; // major units
  stop_sell: boolean;
  closed_to_arrival: boolean;
  closed_to_departure: boolean;
  min_stay_arrival: number | null;
  min_stay_through: number | null;
  max_stay: number | null;
}

// Reuse the canonical field list rather than hand-listing it again — a
// second, independently-maintained copy here would let a future field
// addition silently skip comparison/output, which is exactly the class of
// bug this sparse-push feature exists to prevent.
const COMPARE_KEYS = OVERRIDE_FIELD_KEYS satisfies readonly (keyof EffectiveValues)[];

function sameValues(a: EffectiveValues, b: EffectiveValues, touchedFields?: Set<OverrideFieldKey>): boolean {
  for (const key of COMPARE_KEYS) {
    if (touchedFields && !touchedFields.has(key)) continue;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function toRestrictionFields(
  v: EffectiveValues,
  touchedFields?: Set<OverrideFieldKey>
): Omit<RestrictionValue, "property_id" | "rate_plan_id" | "date_from" | "date_to"> {
  const include = (k: OverrideFieldKey) => !touchedFields || touchedFields.has(k);
  return {
    ...(include("rate") ? { rate: toChannexMinor(v.rate) } : {}),
    ...(include("stop_sell") ? { stop_sell: v.stop_sell } : {}),
    ...(include("closed_to_arrival") ? { closed_to_arrival: v.closed_to_arrival } : {}),
    ...(include("closed_to_departure") ? { closed_to_departure: v.closed_to_departure } : {}),
    ...(include("min_stay_arrival") && v.min_stay_arrival != null ? { min_stay_arrival: v.min_stay_arrival } : {}),
    ...(include("min_stay_through") && v.min_stay_through != null ? { min_stay_through: v.min_stay_through } : {}),
    ...(include("max_stay") && v.max_stay != null ? { max_stay: v.max_stay } : {}),
  };
}

// Run-length-encodes one rate plan's effective values across [from, lastNight]
// into the fewest possible /restrictions entries. Pure/sync — the caller
// supplies the override lookup so this can run once per scope without a
// fresh DB round trip each time.
function computeEntriesForWindow(
  ratePlanRows: any[],
  rpMap: Map<string, string>,
  propertyId: string,
  overrideMap: Map<string, any>,
  from: string,
  lastNight: string,
  touchedFields: Set<OverrideFieldKey> | undefined
): RestrictionValue[] {
  const values: RestrictionValue[] = [];

  for (const rp of ratePlanRows) {
    let runStart: string | null = null;
    let runValues: EffectiveValues | null = null;

    const flush = (endExclusive: string) => {
      if (runStart == null || runValues == null) return;
      const fields = toRestrictionFields(runValues, touchedFields);
      values.push({
        property_id: propertyId,
        rate_plan_id: rpMap.get(rp.id)!,
        date_from: runStart,
        date_to: addDaysISO(endExclusive, -1),
        ...fields,
      });
    };

    let cursor = from;
    while (cursor <= lastNight) {
      const o = overrideMap.get(`${rp.id}:${cursor}`);
      const effective: EffectiveValues = {
        rate: o?.rate ?? rp.base_price ?? 0,
        stop_sell: o?.stop_sell ?? rp.stop_sell ?? false,
        closed_to_arrival: o?.closed_to_arrival ?? rp.closed_to_arrival ?? false,
        closed_to_departure: o?.closed_to_departure ?? rp.closed_to_departure ?? false,
        min_stay_arrival: o?.min_stay_arrival ?? rp.min_stay_arrival ?? null,
        min_stay_through: o?.min_stay_through ?? rp.min_stay_through ?? null,
        max_stay: o?.max_stay ?? rp.max_stay ?? null,
      };

      if (runValues && sameValues(runValues, effective, touchedFields)) {
        cursor = addDaysISO(cursor, 1);
        continue;
      }
      flush(cursor);
      runStart = cursor;
      runValues = effective;
      cursor = addDaysISO(cursor, 1);
    }
    flush(cursor);
  }

  return values;
}

export async function pushRatesForOrg(
  supabase: SupabaseClient,
  orgId: string,
  opts: PushRatesOptions = {}
): Promise<PushRatesResult> {
  const { data: links } = await supabase
    .from("channel_provider_links")
    .select("kind, local_id, channex_id")
    .eq("organization_id", orgId)
    .in("kind", ["property", "rate_plan"]);
  const rows = (links as { kind: string; local_id: string; channex_id: string }[]) ?? [];
  const property = rows.find((r) => r.kind === "property");
  if (!property) return { ok: false, propertyId: null, ratePlansPushed: 0, entries: 0, skipped: "org not provisioned" };
  const propertyId = property.channex_id;

  // local rate_plans.id -> its one mapped Channex rate_plan_id.
  const rpMap = new Map<string, string>();
  for (const r of rows) {
    if (r.kind !== "rate_plan") continue;
    rpMap.set(r.local_id, r.channex_id);
  }
  if (rpMap.size === 0) return { ok: false, propertyId, ratePlansPushed: 0, entries: 0, skipped: "no mapped rate plans" };

  const from = opts.from && opts.from > todayISO() ? opts.from : todayISO();
  const toExclusive = opts.to ?? addDaysISO(from, opts.horizonDays ?? 500);
  const lastNight = addDaysISO(toExclusive, -1);
  if (lastNight < from) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "empty window" };

  const { data: ratePlans } = await supabase
    .from("rate_plans")
    .select("id, base_price, stop_sell, closed_to_arrival, closed_to_departure, min_stay_arrival, min_stay_through, max_stay")
    .eq("organization_id", orgId);

  const filter = opts.roomTypeLocalIds ? new Set(opts.roomTypeLocalIds) : null;
  const ratePlanRows = ((ratePlans as any[]) ?? []).filter((rp) => rpMap.has(rp.id) && (!filter || filter.has(rp.id)));
  if (ratePlanRows.length === 0) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "nothing to push" };

  const { data: overrides } = await supabase
    .from("room_type_rate_overrides")
    .select("rate_plan_id, date, rate, min_stay_arrival, min_stay_through, max_stay, stop_sell, closed_to_arrival, closed_to_departure")
    .eq("organization_id", orgId)
    .in("rate_plan_id", ratePlanRows.map((rp) => rp.id))
    .gte("date", from)
    .lte("date", lastNight);

  const overrideMap = new Map<string, any>(); // `${rate_plan_id}:${date}` -> row
  for (const o of (overrides as any[]) ?? []) overrideMap.set(`${o.rate_plan_id}:${o.date}`, o);

  const values = computeEntriesForWindow(ratePlanRows, rpMap, propertyId, overrideMap, from, lastNight, opts.touchedFields);
  const ratePlansPushed = ratePlanRows.length;

  if (values.length === 0) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "nothing to push" };

  const response = await channex.pushRestrictions(values);
  const channexTaskIds = Array.isArray(response)
    ? response.map((r: any) => r?.id).filter((id: unknown): id is string => typeof id === "string")
    : undefined;
  return { ok: true, propertyId, ratePlansPushed, entries: values.length, channexTaskIds };
}

// One independently-scoped slice of a batched push: its own date window, its
// own rate plan(s), its own touched-fields set. Mirrors one outbox row.
export interface RateScope {
  from: string;
  to: string; // exclusive
  roomTypeLocalIds?: string[]; // rate_plans.id values; undefined = all mapped rate plans
  touchedFields?: Set<OverrideFieldKey>; // undefined = every field (full snapshot) for this scope
}

// Like pushRatesForOrg, but takes several independent scopes and sends them
// all as ONE /restrictions call (one entry per scope x rate plan x
// compressed run) instead of one call per scope. This is what certification
// (and the 20-calls/minute ceiling) actually wants: several edits batched
// into a single HTTP call, each edit's own date range computed on its own —
// never widened to cover another edit's dates. Contrast with
// processOutbox's old behavior of unioning every coalesced row's date range
// into one flat window before computing: that leaked each rate plan's
// baseline-default values into every other row's declared range in the same
// call, which is what certification flagged as wrong coverage/wrong values.
export async function pushRatesForOrgScoped(
  supabase: SupabaseClient,
  orgId: string,
  scopes: RateScope[]
): Promise<PushRatesResult> {
  if (scopes.length === 0) return { ok: true, propertyId: null, ratePlansPushed: 0, entries: 0, skipped: "no scopes" };

  const { data: links } = await supabase
    .from("channel_provider_links")
    .select("kind, local_id, channex_id")
    .eq("organization_id", orgId)
    .in("kind", ["property", "rate_plan"]);
  const linkRows = (links as { kind: string; local_id: string; channex_id: string }[]) ?? [];
  const property = linkRows.find((r) => r.kind === "property");
  if (!property) return { ok: false, propertyId: null, ratePlansPushed: 0, entries: 0, skipped: "org not provisioned" };
  const propertyId = property.channex_id;

  const rpMap = new Map<string, string>();
  for (const r of linkRows) {
    if (r.kind !== "rate_plan") continue;
    rpMap.set(r.local_id, r.channex_id);
  }
  if (rpMap.size === 0) return { ok: false, propertyId, ratePlansPushed: 0, entries: 0, skipped: "no mapped rate plans" };

  const { data: ratePlans } = await supabase
    .from("rate_plans")
    .select("id, base_price, stop_sell, closed_to_arrival, closed_to_departure, min_stay_arrival, min_stay_through, max_stay")
    .eq("organization_id", orgId);
  const allRatePlanRows = ((ratePlans as any[]) ?? []).filter((rp) => rpMap.has(rp.id));
  if (allRatePlanRows.length === 0) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "nothing to push" };

  const today = todayISO();
  const normalized = scopes
    .map((s) => {
      const from = s.from > today ? s.from : today;
      const lastNight = addDaysISO(s.to, -1);
      if (lastNight < from) return null;
      const filter = s.roomTypeLocalIds ? new Set(s.roomTypeLocalIds) : null;
      const ratePlanRows = allRatePlanRows.filter((rp) => !filter || filter.has(rp.id));
      if (ratePlanRows.length === 0) return null;
      return { from, lastNight, ratePlanRows, touchedFields: s.touchedFields };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  if (normalized.length === 0) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "nothing to push" };

  // One shared overrides fetch across every scope's window — cheaper than
  // one query per scope, and each scope only ever reads its own slice of it.
  let unionFrom = normalized[0].from;
  let unionLastNight = normalized[0].lastNight;
  const touchedRatePlanIds = new Set<string>();
  for (const s of normalized) {
    if (s.from < unionFrom) unionFrom = s.from;
    if (s.lastNight > unionLastNight) unionLastNight = s.lastNight;
    for (const rp of s.ratePlanRows) touchedRatePlanIds.add(rp.id);
  }

  const { data: overrides } = await supabase
    .from("room_type_rate_overrides")
    .select("rate_plan_id, date, rate, min_stay_arrival, min_stay_through, max_stay, stop_sell, closed_to_arrival, closed_to_departure")
    .eq("organization_id", orgId)
    .in("rate_plan_id", [...touchedRatePlanIds])
    .gte("date", unionFrom)
    .lte("date", unionLastNight);

  const overrideMap = new Map<string, any>();
  for (const o of (overrides as any[]) ?? []) overrideMap.set(`${o.rate_plan_id}:${o.date}`, o);

  const values: RestrictionValue[] = [];
  const ratePlansPushedIds = new Set<string>();
  for (const s of normalized) {
    values.push(...computeEntriesForWindow(s.ratePlanRows, rpMap, propertyId, overrideMap, s.from, s.lastNight, s.touchedFields));
    for (const rp of s.ratePlanRows) ratePlansPushedIds.add(rp.id);
  }

  if (values.length === 0) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "nothing to push" };

  const response = await channex.pushRestrictions(values);
  const channexTaskIds = Array.isArray(response)
    ? response.map((r: any) => r?.id).filter((id: unknown): id is string => typeof id === "string")
    : undefined;
  return { ok: true, propertyId, ratePlansPushed: ratePlansPushedIds.size, entries: values.length, channexTaskIds };
}
