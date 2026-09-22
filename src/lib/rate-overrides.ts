// Business logic behind the "Rates & Restrictions" bulk-edit form: writes
// per-date overrides for one or more room types over a date range, merging
// only the fields the caller actually touched, then enqueues a single
// Channex restrictions push covering the whole scope of the edit.

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysISO } from "./channels/channex-rates";
import { enqueueRestrictions } from "./channels/channex-outbox";

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
  roomTypeIds: string[];
  dateFrom: string; // inclusive
  dateTo: string; // inclusive
  fields: RateOverrideFields;
}

export interface ApplyRateOverridesResult {
  ok: boolean;
  rowsWritten: number;
  skippedRoomTypeIds: string[];
  error?: string;
}

export const OVERRIDE_FIELD_KEYS = [
  "rate",
  "min_stay_arrival",
  "min_stay_through",
  "max_stay",
  "stop_sell",
  "closed_to_arrival",
  "closed_to_departure",
] as const;
export type OverrideFieldKey = (typeof OVERRIDE_FIELD_KEYS)[number];

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
  const { roomTypeIds, dateFrom, dateTo, fields } = input;
  const touchedKeys = OVERRIDE_FIELD_KEYS.filter((k) => fields[k] !== undefined);
  if (roomTypeIds.length === 0 || touchedKeys.length === 0 || dateTo < dateFrom) {
    return { ok: false, rowsWritten: 0, skippedRoomTypeIds: [], error: "invalid input" };
  }

  // Only touch room types that actually belong to this org.
  const { data: owned } = await supabase
    .from("room_types")
    .select("id")
    .eq("organization_id", orgId)
    .in("id", roomTypeIds);
  const ownedIds = new Set(((owned as { id: string }[]) ?? []).map((r) => r.id));
  const validRoomTypeIds = roomTypeIds.filter((id) => ownedIds.has(id));
  const skippedRoomTypeIds = roomTypeIds.filter((id) => !ownedIds.has(id));
  if (validRoomTypeIds.length === 0) {
    return { ok: false, rowsWritten: 0, skippedRoomTypeIds: roomTypeIds, error: "no matching room types" };
  }

  const dates = dateRangeInclusive(dateFrom, dateTo);

  // Partial upsert: each row carries only the primary-key columns plus the
  // fields actually touched by this edit. PostgREST upsert only SETs the
  // columns present in the payload on conflict, so untouched columns on an
  // existing row are left alone — no read-then-merge, so no silent
  // truncation on a large existing-row scan and no TOCTOU race with a
  // concurrent edit clobbering it with a stale snapshot.
  const upsertRows: Record<string, unknown>[] = [];
  for (const roomTypeId of validRoomTypeIds) {
    for (const date of dates) {
      const row: Record<string, unknown> = {
        organization_id: orgId,
        room_type_id: roomTypeId,
        date,
        updated_at: new Date().toISOString(),
      };
      for (const key of touchedKeys) row[key] = fields[key];
      upsertRows.push(row);
    }
  }

  const { error } = await supabase
    .from("room_type_rate_overrides")
    .upsert(upsertRows, { onConflict: "room_type_id,date" });
  if (error) return { ok: false, rowsWritten: 0, skippedRoomTypeIds, error: error.message };

  await enqueueRestrictions(supabase, orgId, dateFrom, addDaysISO(dateTo, 1), validRoomTypeIds);

  return { ok: true, rowsWritten: upsertRows.length, skippedRoomTypeIds };
}

export async function clearRateOverrideField(
  supabase: SupabaseClient,
  orgId: string,
  overrideId: string,
  field: OverrideFieldKey
): Promise<{ ok: boolean; error?: string }> {
  const { data: row, error: fetchError } = await supabase
    .from("room_type_rate_overrides")
    .select("id, room_type_id, date")
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
  await enqueueRestrictions(supabase, orgId, date, addDaysISO(date, 1), [(row as any).room_type_id]);
  return { ok: true };
}
