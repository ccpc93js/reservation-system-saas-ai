// Channex rate + restriction push. The PMS models rate and the ARI
// restrictions (stop_sell, closed_to_arrival/departure, min_stay_arrival/
// through) as standing values on room_types, applied across the whole
// horizon — not per-date. /restrictions is a partial update: null min-stay
// fields are omitted rather than sent as null, so they never clobber a
// value set some other way. Constant values over a window compress to one
// entry per rate plan. Never sends past dates.

import type { SupabaseClient } from "@supabase/supabase-js";
import { channex, toChannexMinor, type RestrictionValue } from "./channex";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(iso: string, days: number): string {
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

  // local room_type id -> channex rate plan id
  const rpMap = new Map<string, string>();
  for (const r of rows) if (r.kind === "rate_plan") rpMap.set(r.local_id, r.channex_id);
  if (rpMap.size === 0) return { ok: false, propertyId, ratePlansPushed: 0, entries: 0, skipped: "no mapped rate plans" };

  const from = opts.from && opts.from > todayISO() ? opts.from : todayISO();
  const toExclusive = opts.to ?? addDaysISO(from, opts.horizonDays ?? 500);
  const lastNight = addDaysISO(toExclusive, -1);
  if (lastNight < from) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "empty window" };

  const { data: roomTypes } = await supabase
    .from("room_types")
    .select("id, base_price, stop_sell, closed_to_arrival, closed_to_departure, min_stay_arrival, min_stay_through")
    .eq("organization_id", orgId);

  const filter = opts.roomTypeLocalIds ? new Set(opts.roomTypeLocalIds) : null;
  const values: RestrictionValue[] = [];
  for (const rt of (roomTypes as {
    id: string;
    base_price: number;
    stop_sell: boolean;
    closed_to_arrival: boolean;
    closed_to_departure: boolean;
    min_stay_arrival: number | null;
    min_stay_through: number | null;
  }[]) ?? []) {
    if (filter && !filter.has(rt.id)) continue;
    const ratePlanId = rpMap.get(rt.id);
    if (!ratePlanId) continue;
    values.push({
      property_id: propertyId,
      rate_plan_id: ratePlanId,
      date_from: from,
      date_to: lastNight,
      rate: toChannexMinor(rt.base_price ?? 0), // partial update — only the fields below
      stop_sell: rt.stop_sell,
      closed_to_arrival: rt.closed_to_arrival,
      closed_to_departure: rt.closed_to_departure,
      // Omit null min-stay rather than sending null: /restrictions is a partial
      // update, so omitting leaves whatever Channex already has untouched
      // instead of clearing a value set some other way (e.g. the dashboard).
      ...(rt.min_stay_arrival != null ? { min_stay_arrival: rt.min_stay_arrival } : {}),
      ...(rt.min_stay_through != null ? { min_stay_through: rt.min_stay_through } : {}),
    });
  }

  if (values.length === 0) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "nothing to push" };

  await channex.pushRestrictions(values);
  return { ok: true, propertyId, ratePlansPushed: values.length, entries: values.length };
}
