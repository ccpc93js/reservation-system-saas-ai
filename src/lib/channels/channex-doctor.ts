// Channex health check ("doctor"). Verifies the whole integration chain for an
// org: key → API reachable → property/room/rate mappings complete → a sampled
// availability readback matches locally-computed free beds → inbound feed
// reachable (+ pending count) → webhook registered. Returns a structured report
// so a route or CI can gate on it. This catches drift that "the push returned
// 200" never will.

import type { SupabaseClient } from "@supabase/supabase-js";
import { channex, ChannexConfigError } from "./channex";

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DoctorReport {
  ok: boolean;
  orgId: string;
  propertyId: string | null;
  checks: DoctorCheck[];
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function runDoctor(supabase: SupabaseClient, orgId: string): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });
  let propertyId: string | null = null;

  // 1. API key configured.
  const hasKey = !!process.env.CHANNEX_API_KEY;
  add("api_key", hasKey, hasKey ? "CHANNEX_API_KEY is set" : "CHANNEX_API_KEY is missing");
  if (!hasKey) return { ok: false, orgId, propertyId, checks };

  // 2. API reachable.
  try {
    const props = await channex.listProperties();
    add("api_reachable", true, `GET /properties → ${Array.isArray(props) ? props.length : 0} properties`);
  } catch (err) {
    add("api_reachable", false, err instanceof Error ? err.message : "unreachable");
    return { ok: false, orgId, propertyId, checks };
  }

  // 3. Provisioned (property link) + gather mapping links.
  const { data: links } = await supabase
    .from("channel_provider_links")
    .select("kind, local_id, channex_id")
    .eq("organization_id", orgId)
    .in("kind", ["property", "room_type", "rate_plan"]);
  const rows = (links as { kind: string; local_id: string; channex_id: string }[]) ?? [];
  const prop = rows.find((r) => r.kind === "property");
  propertyId = prop?.channex_id ?? null;
  add("provisioned", !!propertyId, propertyId ? `property ${propertyId}` : "org has no Channex property link — run provisioning");
  if (!propertyId) return { ok: false, orgId, propertyId, checks };

  // 4. Every room type has a room_type + rate_plan mapping.
  const { data: roomTypes } = await supabase.from("room_types").select("id, name").eq("organization_id", orgId);
  const rtLinked = new Set(rows.filter((r) => r.kind === "room_type").map((r) => r.local_id));
  const rpLinked = new Set(rows.filter((r) => r.kind === "rate_plan").map((r) => r.local_id));
  const missing: string[] = [];
  for (const rt of (roomTypes as { id: string; name: string }[]) ?? []) {
    if (!rtLinked.has(rt.id)) missing.push(`${rt.name} (room type)`);
    if (!rpLinked.has(rt.id)) missing.push(`${rt.name} (rate plan)`);
  }
  add("mappings_complete", missing.length === 0, missing.length === 0 ? `all ${(roomTypes ?? []).length} room types mapped` : `unmapped: ${missing.join(", ")}`);

  // 5. Sampled availability readback matches locally-computed free beds.
  try {
    const from = iso(new Date());
    const to = iso(new Date(Date.now() + 7 * 86400000));
    const [remote, { data: calendar }] = await Promise.all([
      channex.getAvailability(propertyId, from, to),
      supabase.rpc("free_beds_calendar", { p_organization_id: orgId, p_from: from, p_to: to }),
    ]);
    const rtChannex = new Map(rows.filter((r) => r.kind === "room_type").map((r) => [r.local_id, r.channex_id]));
    let compared = 0;
    let mismatch = "";
    for (const row of (calendar as { room_type_id: string; d: string; free: number }[]) ?? []) {
      const cid = rtChannex.get(row.room_type_id);
      if (!cid) continue;
      const remoteVal = remote?.[cid]?.[row.d];
      if (remoteVal === undefined) continue;
      compared++;
      if (Number(remoteVal) !== row.free) {
        mismatch = `${row.d} rt=${cid.slice(0, 8)} local=${row.free} channex=${remoteVal}`;
        break;
      }
    }
    add("availability_synced", !mismatch, mismatch ? `drift: ${mismatch} — run availability reconcile` : `${compared} cells match over ${from}…${to}`);
  } catch (err) {
    add("availability_synced", false, err instanceof Error ? err.message : "readback failed");
  }

  // 6. Inbound feed reachable + pending count.
  try {
    const page = await channex.bookingFeed(1);
    const pending = page.meta?.total ?? 0;
    add("feed_reachable", true, `feed reachable, ${pending} pending revision(s)`);
  } catch (err) {
    add("feed_reachable", false, err instanceof Error ? err.message : "feed unreachable");
  }

  // 7. Webhook registered (informational — feed poller is the backstop).
  try {
    const hooks = await channex.listWebhooks();
    const registered = hooks.some((h) => typeof (h.attributes as any)?.callback_url === "string" && (h.attributes as any).callback_url.includes("/api/channels/channex/webhook"));
    add("webhook_registered", true, registered ? "webhook registered" : "no webhook (feed poller is the backstop)");
  } catch (err) {
    add("webhook_registered", false, err instanceof Error ? err.message : "could not list webhooks");
  }

  // Overall: fail on any hard check. Webhook-missing is not a hard failure.
  const hardFail = checks.some((c) => !c.ok && c.name !== "webhook_registered");
  return { ok: !hardFail, orgId, propertyId, checks };
}

export function isConfigError(err: unknown): err is ChannexConfigError {
  return err instanceof ChannexConfigError;
}
