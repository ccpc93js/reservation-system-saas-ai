// Channex rate + restriction push. Reads each room type's standing defaults
// (rate, stop_sell, closed_to_arrival/departure, min_stay_arrival/through,
// max_stay) plus any per-date overrides in room_type_rate_overrides, computes
// the effective value per night, and run-length compresses consecutive
// nights with identical values into the fewest possible /restrictions
// entries. /restrictions is a partial update: a field omitted from an entry
// leaves whatever Channex already has for that date untouched rather than
// clearing it, so min-stay/max-stay fields are only included when a value is
// set. Pushed to every rate plan mapped to a room type (usually one; a room
// type mapped to multiple Channex rate plans receives the same values on
// each — see docs/superpowers/specs/2026-09-14-rate-calendar-design.md).
// Never sends past dates.

import type { SupabaseClient } from "@supabase/supabase-js";
import { channex, toChannexMinor, type RestrictionValue } from "./channex";

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
  roomTypeLocalIds?: string[];
}

export interface PushRatesResult {
  ok: boolean;
  propertyId: string | null;
  ratePlansPushed: number;
  entries: number;
  skipped?: string;
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

function sameValues(a: EffectiveValues, b: EffectiveValues): boolean {
  return (
    a.rate === b.rate &&
    a.stop_sell === b.stop_sell &&
    a.closed_to_arrival === b.closed_to_arrival &&
    a.closed_to_departure === b.closed_to_departure &&
    a.min_stay_arrival === b.min_stay_arrival &&
    a.min_stay_through === b.min_stay_through &&
    a.max_stay === b.max_stay
  );
}

function toRestrictionFields(
  v: EffectiveValues
): Omit<RestrictionValue, "property_id" | "rate_plan_id" | "date_from" | "date_to"> {
  return {
    rate: toChannexMinor(v.rate),
    stop_sell: v.stop_sell,
    closed_to_arrival: v.closed_to_arrival,
    closed_to_departure: v.closed_to_departure,
    ...(v.min_stay_arrival != null ? { min_stay_arrival: v.min_stay_arrival } : {}),
    ...(v.min_stay_through != null ? { min_stay_through: v.min_stay_through } : {}),
    ...(v.max_stay != null ? { max_stay: v.max_stay } : {}),
  };
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

  // local room_type id -> ALL mapped channex rate plan ids (usually one).
  const rpMap = new Map<string, string[]>();
  for (const r of rows) {
    if (r.kind !== "rate_plan") continue;
    const list = rpMap.get(r.local_id) ?? [];
    list.push(r.channex_id);
    rpMap.set(r.local_id, list);
  }
  if (rpMap.size === 0) return { ok: false, propertyId, ratePlansPushed: 0, entries: 0, skipped: "no mapped rate plans" };

  const from = opts.from && opts.from > todayISO() ? opts.from : todayISO();
  const toExclusive = opts.to ?? addDaysISO(from, opts.horizonDays ?? 500);
  const lastNight = addDaysISO(toExclusive, -1);
  if (lastNight < from) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "empty window" };

  const { data: roomTypes } = await supabase
    .from("room_types")
    .select("id, base_price, stop_sell, closed_to_arrival, closed_to_departure, min_stay_arrival, min_stay_through, max_stay")
    .eq("organization_id", orgId);

  const filter = opts.roomTypeLocalIds ? new Set(opts.roomTypeLocalIds) : null;
  const roomTypeRows = ((roomTypes as any[]) ?? []).filter((rt) => rpMap.has(rt.id) && (!filter || filter.has(rt.id)));
  if (roomTypeRows.length === 0) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "nothing to push" };

  const { data: overrides } = await supabase
    .from("room_type_rate_overrides")
    .select("room_type_id, date, rate, min_stay_arrival, min_stay_through, max_stay, stop_sell, closed_to_arrival, closed_to_departure")
    .eq("organization_id", orgId)
    .in("room_type_id", roomTypeRows.map((rt) => rt.id))
    .gte("date", from)
    .lte("date", lastNight);

  const overrideMap = new Map<string, any>(); // `${room_type_id}:${date}` -> row
  for (const o of (overrides as any[]) ?? []) overrideMap.set(`${o.room_type_id}:${o.date}`, o);

  const values: RestrictionValue[] = [];
  let ratePlansPushed = 0;

  for (const rt of roomTypeRows) {
    let runStart: string | null = null;
    let runValues: EffectiveValues | null = null;

    const flush = (endExclusive: string) => {
      if (runStart == null || runValues == null) return;
      const fields = toRestrictionFields(runValues);
      for (const ratePlanId of rpMap.get(rt.id)!) {
        values.push({
          property_id: propertyId,
          rate_plan_id: ratePlanId,
          date_from: runStart,
          date_to: addDaysISO(endExclusive, -1),
          ...fields,
        });
      }
    };

    let cursor = from;
    while (cursor <= lastNight) {
      const o = overrideMap.get(`${rt.id}:${cursor}`);
      const effective: EffectiveValues = {
        rate: o?.rate ?? rt.base_price ?? 0,
        stop_sell: o?.stop_sell ?? rt.stop_sell ?? false,
        closed_to_arrival: o?.closed_to_arrival ?? rt.closed_to_arrival ?? false,
        closed_to_departure: o?.closed_to_departure ?? rt.closed_to_departure ?? false,
        min_stay_arrival: o?.min_stay_arrival ?? rt.min_stay_arrival ?? null,
        min_stay_through: o?.min_stay_through ?? rt.min_stay_through ?? null,
        max_stay: o?.max_stay ?? rt.max_stay ?? null,
      };

      if (runValues && sameValues(runValues, effective)) {
        cursor = addDaysISO(cursor, 1);
        continue;
      }
      flush(cursor);
      runStart = cursor;
      runValues = effective;
      cursor = addDaysISO(cursor, 1);
    }
    flush(cursor);

    ratePlansPushed += rpMap.get(rt.id)!.length;
  }

  if (values.length === 0) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "nothing to push" };

  await channex.pushRestrictions(values);
  return { ok: true, propertyId, ratePlansPushed, entries: values.length };
}
