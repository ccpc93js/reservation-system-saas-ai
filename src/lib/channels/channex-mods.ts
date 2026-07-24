// Channex OTA modification review. "modified" revisions are parked in
// channex_pending_mods; a manager applies or dismisses them here. Apply handles
// the common case — date (and amount) changes — reassigning beds within the
// same room type when the new dates clash, and refusing (leaving the mod
// pending) if that would overbook. Room-type changes are not auto-applied.

import type { SupabaseClient } from "@supabase/supabase-js";
import { syncAvailabilityWindow } from "./channex-availability";

export interface PendingMod {
  id: string;
  reservation_id: string;
  booking_id: string;
  ota_name: string | null;
  ota_reservation_code: string | null;
  new_check_in: string | null;
  new_check_out: string | null;
  new_amount: number | null;
  reservation_number: string | null;
  current_check_in: string | null;
  current_check_out: string | null;
  guest_name: string | null;
}

export async function listPendingMods(supabase: SupabaseClient, orgId: string): Promise<PendingMod[]> {
  const { data } = await supabase
    .from("channex_pending_mods")
    .select("id, reservation_id, booking_id, ota_name, ota_reservation_code, new_check_in, new_check_out, new_amount, reservations(reservation_number, check_in, check_out, guests(first_name, last_name))")
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return ((data as any[]) ?? []).map((m) => {
    const r = m.reservations;
    const g = r?.guests;
    return {
      id: m.id,
      reservation_id: m.reservation_id,
      booking_id: m.booking_id,
      ota_name: m.ota_name,
      ota_reservation_code: m.ota_reservation_code,
      new_check_in: m.new_check_in,
      new_check_out: m.new_check_out,
      new_amount: m.new_amount,
      reservation_number: r?.reservation_number ?? null,
      current_check_in: r?.check_in ?? null,
      current_check_out: r?.check_out ?? null,
      guest_name: g ? `${g.first_name} ${g.last_name}` : null,
    };
  });
}

export async function dismissModification(supabase: SupabaseClient, orgId: string, modId: string): Promise<{ ok: boolean }> {
  await supabase
    .from("channex_pending_mods")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", modId)
    .eq("organization_id", orgId)
    .eq("status", "pending");
  return { ok: true };
}

async function bedFree(
  supabase: SupabaseClient,
  bedId: string,
  reservationId: string,
  checkIn: string,
  checkOut: string
): Promise<boolean> {
  const { data } = await supabase
    .from("reservation_items")
    .select("id, reservations!inner(status)")
    .eq("bed_id", bedId)
    .neq("reservation_id", reservationId)
    .lt("check_in", checkOut)
    .gt("check_out", checkIn)
    .not("reservations.status", "in", '("cancelled","no_show")')
    .limit(1);
  return !data || data.length === 0;
}

export async function applyModification(
  supabase: SupabaseClient,
  orgId: string,
  modId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: mod } = await supabase
    .from("channex_pending_mods")
    .select("*")
    .eq("id", modId)
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .maybeSingle();
  if (!mod) return { ok: false, error: "modification not found or already resolved" };

  const m = mod as any;
  const { data: res } = await supabase
    .from("reservations")
    .select("id, check_in, check_out")
    .eq("id", m.reservation_id)
    .maybeSingle();
  if (!res) return { ok: false, error: "reservation not found" };

  const oldIn = (res as any).check_in as string;
  const oldOut = (res as any).check_out as string;
  const newIn = m.new_check_in || oldIn;
  const newOut = m.new_check_out || oldOut;
  if (new Date(newOut) <= new Date(newIn)) return { ok: false, error: "invalid modified dates" };

  const datesChanged = newIn !== oldIn || newOut !== oldOut;

  if (datesChanged) {
    // Each item keeps its bed if free for the new dates, else move to a free
    // bed in the same room type. Refuse if any can't be placed (overbooking).
    const { data: items } = await supabase
      .from("reservation_items")
      .select("id, bed_id, beds(room_id, rooms(room_type_id))")
      .eq("reservation_id", m.reservation_id);

    const nights = Math.max(1, Math.round((new Date(newOut).getTime() - new Date(newIn).getTime()) / 86400000));

    for (const it of (items as any[]) ?? []) {
      let bedId = it.bed_id as string;
      if (!(await bedFree(supabase, bedId, m.reservation_id, newIn, newOut))) {
        // Find a free bed in the same room type.
        const roomTypeId = it.beds?.rooms?.room_type_id;
        const { data: candidates } = await supabase
          .from("beds")
          .select("id, rooms!inner(room_type_id)")
          .eq("rooms.room_type_id", roomTypeId)
          .eq("is_active", true);
        let placed: string | null = null;
        for (const c of (candidates as any[]) ?? []) {
          if (await bedFree(supabase, c.id, m.reservation_id, newIn, newOut)) { placed = c.id; break; }
        }
        if (!placed) return { ok: false, error: "new dates overbook this room type — resolve manually, then dismiss" };
        bedId = placed;
      }
      await supabase
        .from("reservation_items")
        .update({ bed_id: bedId, check_in: newIn, check_out: newOut })
        .eq("id", it.id);
    }

    await supabase
      .from("reservations")
      .update({ check_in: newIn, check_out: newOut, external_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", m.reservation_id);
    void nights;
  }

  if (m.new_amount != null) {
    await supabase.from("reservations").update({ total_amount: m.new_amount }).eq("id", m.reservation_id);
  }

  await supabase
    .from("channex_pending_mods")
    .update({ status: "applied", resolved_at: new Date().toISOString() })
    .eq("id", modId);

  // Availability moved (old window freed, new window taken).
  const from = oldIn < newIn ? oldIn : newIn;
  const to = oldOut > newOut ? oldOut : newOut;
  await syncAvailabilityWindow(supabase, orgId, from, to);

  return { ok: true };
}
