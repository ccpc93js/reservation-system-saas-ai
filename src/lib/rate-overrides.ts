// Business logic behind the "Rates & Restrictions" bulk-edit form: writes
// per-date overrides for one or more rate plans over a date range, merging
// only the fields the caller actually touched, then enqueues a single
// Channex restrictions push covering the whole scope of the edit, tagged
// with which fields were touched (so the push can be sparse).

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysISO } from "./channels/channex-rates";
import { enqueueRestrictions } from "./channels/channex-outbox";
import { OVERRIDE_FIELD_KEYS, type OverrideFieldKey } from "./channels/channex";

// Re-exported for existing callers (route handlers, validation schemas) —
// the canonical definition lives in channex.ts since other Channex-push
// modules besides this one need it too.
export { OVERRIDE_FIELD_KEYS, type OverrideFieldKey };

export interface RateOverrideFields {
  rate?: number;
  min_stay_arrival?: number;
  min_stay_through?: number;
  max_stay?: number;
  stop_sell?: boolean;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
}

export interface ApplyRateOverridesInput {
  ratePlanIds: string[];
  dateFrom: string; // inclusive
  dateTo: string; // inclusive
  fields: RateOverrideFields;
}

export interface ApplyRateOverridesResult {
  ok: boolean;
  rowsWritten: number;
  skippedRatePlanIds: string[];
  error?: string;
}

function dateRangeInclusive(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) dates.push(d);
  return dates;
}

export async function applyRateOverrides(
  supabase: SupabaseClient,
  orgId: string,
  input: ApplyRateOverridesInput
): Promise<ApplyRateOverridesResult> {
  const { ratePlanIds, dateFrom, dateTo, fields } = input;
  const touchedKeys = OVERRIDE_FIELD_KEYS.filter((k) => fields[k] !== undefined);
  if (ratePlanIds.length === 0 || touchedKeys.length === 0 || dateTo < dateFrom) {
    return { ok: false, rowsWritten: 0, skippedRatePlanIds: [], error: "invalid input" };
  }

  // Only touch rate plans that actually belong to this org.
  const { data: owned } = await supabase
    .from("rate_plans")
    .select("id")
    .eq("organization_id", orgId)
    .in("id", ratePlanIds);
  const ownedIds = new Set(((owned as { id: string }[]) ?? []).map((r) => r.id));
  // Dedupe: a repeated id would otherwise produce two upsert rows with the
  // same (rate_plan_id, date) conflict target in one statement, which
  // Postgres rejects ("ON CONFLICT DO UPDATE command cannot affect row a
  // second time").
  const validRatePlanIds = [...new Set(ratePlanIds.filter((id) => ownedIds.has(id)))];
  const skippedRatePlanIds = ratePlanIds.filter((id) => !ownedIds.has(id));
  if (validRatePlanIds.length === 0) {
    return { ok: false, rowsWritten: 0, skippedRatePlanIds: ratePlanIds, error: "no matching rate plans" };
  }

  const dates = dateRangeInclusive(dateFrom, dateTo);

  // Partial upsert: each row carries only the primary-key columns plus the
  // fields actually touched by this edit. PostgREST upsert only SETs the
  // columns present in the payload on conflict, so untouched columns on an
  // existing row are left alone.
  const upsertRows: Record<string, unknown>[] = [];
  for (const ratePlanId of validRatePlanIds) {
    for (const date of dates) {
      const row: Record<string, unknown> = {
        organization_id: orgId,
        rate_plan_id: ratePlanId,
        date,
        updated_at: new Date().toISOString(),
      };
      for (const key of touchedKeys) row[key] = fields[key];
      upsertRows.push(row);
    }
  }

  const { error } = await supabase
    .from("room_type_rate_overrides")
    .upsert(upsertRows, { onConflict: "rate_plan_id,date" });
  if (error) return { ok: false, rowsWritten: 0, skippedRatePlanIds, error: error.message };

  await enqueueRestrictions(supabase, orgId, dateFrom, addDaysISO(dateTo, 1), validRatePlanIds, touchedKeys as string[]);

  return { ok: true, rowsWritten: upsertRows.length, skippedRatePlanIds };
}

export async function clearRateOverrideField(
  supabase: SupabaseClient,
  orgId: string,
  overrideId: string,
  field: OverrideFieldKey
): Promise<{ ok: boolean; error?: string }> {
  const { data: row, error: fetchError } = await supabase
    .from("room_type_rate_overrides")
    .select("id, rate_plan_id, date")
    .eq("id", overrideId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (fetchError || !row) return { ok: false, error: "not found" };

  const { error } = await supabase
    .from("room_type_rate_overrides")
    .update({ [field]: null, updated_at: new Date().toISOString() })
    .eq("id", overrideId);
  if (error) return { ok: false, error: error.message };

  const date = (row as any).date;
  await enqueueRestrictions(supabase, orgId, date, addDaysISO(date, 1), [(row as any).rate_plan_id], [field]);
  return { ok: true };
}
