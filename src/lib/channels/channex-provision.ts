// Channex provisioning — app-driven, fully white-label. The hostel owner never
// opens Channex: this mirrors the org's property, room types and rate plans
// into Channex from PMS data and stores the returned UUIDs in
// channel_provider_links. Idempotent — safe to re-run (POST when unmapped, PUT
// when already mapped), so it doubles as a "sync structure" repair.
//
// Mapping model (see docs/plans/2026-07-07-channex-implementation-plan.md):
//   dorm    -> sold per bed:  count_of_rooms = active beds, occ 1, room_kind dorm
//   private -> sold per room: count_of_rooms = rooms,       occ = capacity, room
// Rate plans: one Channex rate plan per local rate_plans row (a room type can
// have several — e.g. "Best Available Rate" vs "Bed & Breakfast" — each with
// its own price/restrictions and its own Channex mapping). sell_mode
// per_room, occupancy clamped to occ_adults (Channex 422s if a rate plan
// occupancy exceeds the room type's).

import type { SupabaseClient } from "@supabase/supabase-js";
import { channex, toChannexMinor, ChannexError } from "./channex";

interface ProvisionResultRow {
  name: string;
  kind: "property" | "room_type" | "rate_plan";
  action: "created" | "updated" | "skipped" | "error";
  channexId?: string;
  warning?: string;
}

export interface ProvisionResult {
  propertyId: string | null;
  rows: ProvisionResultRow[];
  warnings: string[];
  ok: boolean;
}

// Persisted id mapping helpers (channel_provider_links).
async function getLink(
  supabase: SupabaseClient,
  orgId: string,
  kind: string,
  localId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("channel_provider_links")
    .select("channex_id")
    .eq("organization_id", orgId)
    .eq("kind", kind)
    .eq("local_id", localId)
    .maybeSingle();
  return (data as { channex_id: string } | null)?.channex_id ?? null;
}

async function saveLink(
  supabase: SupabaseClient,
  orgId: string,
  kind: string,
  localId: string,
  channexId: string
): Promise<void> {
  await supabase
    .from("channel_provider_links")
    .upsert(
      { organization_id: orgId, kind, local_id: localId, channex_id: channexId, updated_at: new Date().toISOString() },
      { onConflict: "organization_id,kind,local_id" }
    );
}

export async function provisionOrg(supabase: SupabaseClient, orgId: string): Promise<ProvisionResult> {
  const rows: ProvisionResultRow[] = [];
  const warnings: string[] = [];

  // 1. Load org + room types + unit counts.
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id, name, currency, timezone, country, city, address, email, phone, website")
    .eq("id", orgId)
    .single();
  if (orgErr || !org) {
    return { propertyId: null, rows, warnings: ["Organization not found"], ok: false };
  }

  const { data: roomTypes } = await supabase
    .from("room_types")
    .select("id, name, type, capacity")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, room_type_id")
    .eq("organization_id", orgId);

  const { data: beds } = await supabase
    .from("beds")
    .select("id, room_id, is_active, rooms(room_type_id)")
    .eq("organization_id", orgId);

  const currency = (org as any).currency || "EUR";

  // Count sellable units per room type.
  const roomCount = new Map<string, number>();
  for (const r of (rooms as { id: string; room_type_id: string }[]) ?? []) {
    roomCount.set(r.room_type_id, (roomCount.get(r.room_type_id) ?? 0) + 1);
  }
  const bedCount = new Map<string, number>();
  for (const b of (beds as any[]) ?? []) {
    if (b.is_active === false) continue;
    const rtId = b.rooms?.room_type_id;
    if (rtId) bedCount.set(rtId, (bedCount.get(rtId) ?? 0) + 1);
  }

  // 2. Property (get-or-create). local_id = orgId for the property kind.
  const country = typeof (org as any).country === "string" && (org as any).country.length === 2
    ? (org as any).country
    : undefined;
  if (!country && (org as any).country) {
    warnings.push(`country "${(org as any).country}" is not a 2-letter code — omitted; set an ISO country on the org.`);
  }

  const propertyAttrs = {
    title: (org as any).name,
    currency,
    timezone: (org as any).timezone,
    email: (org as any).email || undefined,
    phone: (org as any).phone || undefined,
    website: (org as any).website || undefined,
    city: (org as any).city || undefined,
    address: (org as any).address || undefined,
    country,
  };

  let propertyId: string | null = null;
  try {
    const existing = await getLink(supabase, orgId, "property", orgId);
    const res = existing
      ? await channex.updateProperty(existing, propertyAttrs)
      : await channex.createProperty(propertyAttrs);
    propertyId = res.id;
    await saveLink(supabase, orgId, "property", orgId, res.id);
    rows.push({ name: (org as any).name, kind: "property", action: existing ? "updated" : "created", channexId: res.id });
  } catch (err) {
    rows.push({ name: (org as any).name, kind: "property", action: "error", warning: errMsg(err) });
    return { propertyId: null, rows, warnings, ok: false };
  }

  if (!propertyId) return { propertyId: null, rows, warnings, ok: false };
  const propId: string = propertyId;

  // 3. Room types (physical attributes only).
  const channexRoomTypeIds = new Map<string, string>(); // local room_type id -> channex id, for rate plans below

  for (const rt of (roomTypes as { id: string; name: string; type: string; capacity: number }[]) ?? []) {
    const isDorm = rt.type === "dorm";
    const capacity = Math.max(1, rt.capacity || 1);
    const countOfRooms = isDorm ? (bedCount.get(rt.id) ?? 0) : (roomCount.get(rt.id) ?? 0);
    const occAdults = isDorm ? 1 : capacity;

    if (countOfRooms < 1) {
      rows.push({ name: rt.name, kind: "room_type", action: "skipped", warning: isDorm ? "no active beds" : "no rooms" });
      continue;
    }

    try {
      const existing = await getLink(supabase, orgId, "room_type", rt.id);
      const attrs = {
        property_id: propId,
        title: rt.name,
        count_of_rooms: countOfRooms,
        occ_adults: occAdults,
        // Channex staging rejects blank occ_children/occ_infants ("can't be
        // blank") despite the docs marking them optional — always send them.
        occ_children: 0,
        occ_infants: 0,
        default_occupancy: occAdults,
        room_kind: (isDorm ? "dorm" : "room") as "dorm" | "room",
      };
      const res = existing ? await channex.updateRoomType(existing, attrs) : await channex.createRoomType(attrs);
      channexRoomTypeIds.set(rt.id, res.id);
      await saveLink(supabase, orgId, "room_type", rt.id, res.id);
      rows.push({ name: rt.name, kind: "room_type", action: existing ? "updated" : "created", channexId: res.id });
    } catch (err) {
      rows.push({ name: rt.name, kind: "room_type", action: "error", warning: errMsg(err) });
    }
  }

  // 4. Rate plans — one Channex rate plan per local rate_plans row.
  const { data: ratePlans } = await supabase
    .from("rate_plans")
    .select("id, room_type_id, name, base_price")
    .eq("organization_id", orgId);

  for (const rp of (ratePlans as { id: string; room_type_id: string; name: string; base_price: number }[]) ?? []) {
    const channexRoomTypeId = channexRoomTypeIds.get(rp.room_type_id);
    if (!channexRoomTypeId) {
      rows.push({ name: rp.name, kind: "rate_plan", action: "skipped", warning: "room type not provisioned" });
      continue;
    }
    const roomType = ((roomTypes as any[]) ?? []).find((rt) => rt.id === rp.room_type_id);
    const isDorm = roomType?.type === "dorm";
    const occAdults = isDorm ? 1 : Math.max(1, roomType?.capacity || 1);

    try {
      const existing = await getLink(supabase, orgId, "rate_plan", rp.id);
      const attrs = {
        property_id: propId,
        room_type_id: channexRoomTypeId,
        title: rp.name,
        currency,
        sell_mode: "per_room" as const,
        rate_mode: "manual" as const,
        options: [{ occupancy: occAdults, is_primary: true, rate: toChannexMinor(rp.base_price ?? 0) }],
      };
      const res = existing ? await channex.updateRatePlan(existing, attrs) : await channex.createRatePlan(attrs);
      await saveLink(supabase, orgId, "rate_plan", rp.id, res.id);
      rows.push({ name: rp.name, kind: "rate_plan", action: existing ? "updated" : "created", channexId: res.id });
    } catch (err) {
      rows.push({ name: rp.name, kind: "rate_plan", action: "error", warning: errMsg(err) });
    }
  }

  const ok = !rows.some((r) => r.action === "error");
  return { propertyId, rows, warnings, ok };
}

function errMsg(err: unknown): string {
  if (err instanceof ChannexError) return err.message;
  return err instanceof Error ? err.message : "Unknown error";
}
