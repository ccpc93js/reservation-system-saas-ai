// Channex Phase 5 — OTA channel connection (Channel API). White-label: the app
// validates the OTA credentials, reads the OTA's rooms/rates, lets the owner
// map them to our rate plans, then creates + activates the channel in Channex.
// The owner never opens the Channex dashboard. A connected channel is stored as
// a channels row with provider='channex'.
//
// One irreducible manual step remains on the OTA side: Booking.com requires the
// property to authorize the connectivity provider in its extranet — the UI
// guides that; nothing here can remove it.

import type { SupabaseClient } from "@supabase/supabase-js";
import { channex, ChannexError, type ChannelRatePlanMapping } from "./channex";

// OTA <-> Channex channel code + our platform key.
const CHANNEL_CODE: Record<string, string> = {
  booking_com: "BookingCom",
  airbnb: "Airbnb",
  expedia: "Expedia",
  hostelworld: "Hostelworld",
  vrbo: "HomeAway",
};
const PLATFORM_FROM_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CHANNEL_CODE).map(([k, v]) => [v, k])
);
const PLATFORM_COLOR: Record<string, string> = {
  booking_com: "#003580",
  airbnb: "#FF5A5F",
  expedia: "#FFC72C",
  hostelworld: "#F06400",
  vrbo: "#195FBA",
};

async function propertyContext(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ propertyId: string; groupId: string } | null> {
  const { data } = await supabase
    .from("channel_provider_links")
    .select("channex_id")
    .eq("organization_id", orgId)
    .eq("kind", "property")
    .maybeSingle();
  const propertyId = (data as { channex_id: string } | null)?.channex_id;
  if (!propertyId) return null;

  // group_id comes from the property options (its owning group).
  const options = await channex.propertyOptions();
  const prop = options.find((p) => p.id === propertyId);
  const groupId = prop?.group_ids?.[0];
  if (!groupId) return null;
  return { propertyId, groupId };
}

export interface ConnectOptions {
  ok: boolean;
  error?: string;
  propertyId?: string;
  groupId?: string;
  otaRooms?: unknown[]; // mapping_details rooms (OTA side)
  ratePlans?: { id: string; title: string; room_type_id: string; occupancy: number }[]; // our side
}

/** Validate OTA credentials and return both sides for the mapping screen. */
export async function getConnectOptions(
  supabase: SupabaseClient,
  orgId: string,
  platform: string,
  hotelId: string
): Promise<ConnectOptions> {
  const channelCode = CHANNEL_CODE[platform];
  if (!channelCode) return { ok: false, error: `unsupported channel "${platform}"` };

  const ctx = await propertyContext(supabase, orgId);
  if (!ctx) return { ok: false, error: "organization not provisioned — enable the channel manager first" };

  try {
    const test = await channex.testConnection(channelCode, hotelId);
    if (!test.success) return { ok: false, error: "OTA credentials rejected — check the hotel ID and extranet authorization" };

    const details = await channex.mappingDetails(channelCode, hotelId);
    const ratePlans = await channex.ratePlanOptions(ctx.propertyId);

    return {
      ok: true,
      propertyId: ctx.propertyId,
      groupId: ctx.groupId,
      otaRooms: details.rooms ?? [],
      ratePlans: ratePlans.map((r) => ({
        id: r.id,
        title: r.title,
        room_type_id: r.room_type_id,
        occupancy: r.occupancy,
      })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof ChannexError ? err.message : "connection check failed" };
  }
}

export interface ConnectMapping {
  ratePlanId: string; // our Channex rate plan UUID
  roomTypeCode: number; // OTA room id (integer)
  ratePlanCode: number; // OTA rate id (integer)
  occupancy?: number;
  pricingType?: string;
  primaryOcc?: boolean;
}

export interface ConnectResult {
  ok: boolean;
  error?: string;
  channelRowId?: string;
  channexChannelId?: string;
  status?: string;
}

/** Create + activate the OTA channel from the owner's mapping, and persist it. */
export async function connectChannel(
  supabase: SupabaseClient,
  orgId: string,
  input: { platform: string; hotelId: string; title: string; mappings: ConnectMapping[] }
): Promise<ConnectResult> {
  const channelCode = CHANNEL_CODE[input.platform];
  if (!channelCode) return { ok: false, error: `unsupported channel "${input.platform}"` };
  if (!input.mappings.length) return { ok: false, error: "at least one room/rate mapping is required" };

  const ctx = await propertyContext(supabase, orgId);
  if (!ctx) return { ok: false, error: "organization not provisioned" };

  const rate_plans: ChannelRatePlanMapping[] = input.mappings.map((m) => ({
    rate_plan_id: m.ratePlanId,
    settings: {
      room_type_code: m.roomTypeCode, // integers — strings land under "removed rates"
      rate_plan_code: m.ratePlanCode,
      occupancy: m.occupancy ?? null,
      pricing_type: m.pricingType,
      primary_occ: m.primaryOcc ?? true,
    },
  }));

  try {
    const created = await channex.createChannel({
      channel: channelCode,
      group_id: ctx.groupId,
      title: input.title,
      properties: [ctx.propertyId],
      rate_plans,
      settings: { hotel_id: input.hotelId },
      is_active: false,
    });
    await channex.activateChannel(created.id);

    // Persist as a channels row (provider='channex').
    const { data: row, error } = await supabase
      .from("channels")
      .insert({
        organization_id: orgId,
        name: input.title,
        platform: input.platform,
        provider: "channex",
        channex_channel_id: created.id,
        hotel_id: input.hotelId,
        channex_status: "active",
        color: PLATFORM_COLOR[input.platform] ?? "#6366f1",
      })
      .select("id")
      .single();
    if (error) {
      // Channel is live in Channex but we failed to persist — surface loudly.
      return { ok: false, error: `channel activated but not saved locally: ${error.message}`, channexChannelId: created.id };
    }

    return { ok: true, channelRowId: (row as any).id, channexChannelId: created.id, status: "active" };
  } catch (err) {
    return { ok: false, error: err instanceof ChannexError ? err.message : "channel creation failed" };
  }
}

/** Deactivate + delete the OTA channel in Channex, then remove the local row. */
export async function disconnectChannel(
  supabase: SupabaseClient,
  orgId: string,
  channelRowId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: row } = await supabase
    .from("channels")
    .select("id, channex_channel_id")
    .eq("id", channelRowId)
    .eq("organization_id", orgId)
    .maybeSingle();
  const channexId = (row as { channex_channel_id: string | null } | null)?.channex_channel_id;

  try {
    if (channexId) {
      // Must deactivate before delete (422 "is active" otherwise).
      await channex.deactivateChannel(channexId).catch(() => {});
      await channex.deleteChannel(channexId);
    }
    await supabase.from("channels").delete().eq("id", channelRowId).eq("organization_id", orgId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ChannexError ? err.message : "disconnect failed" };
  }
}

export { PLATFORM_FROM_CODE };
