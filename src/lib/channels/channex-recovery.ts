// Channex outage recovery — a MANUAL, time-scoped backfill for the rare case
// where the feed poller (and webhook) were down for more than the 30-minute
// revision window, so bookings dropped out of the feed for good. It re-pulls
// the DURABLE booking list since the outage started and applies anything the
// PMS is missing, deduped by Channex booking id (via applyRevision's external_id
// check). NOT a cron — running it periodically re-pulls the same bookings
// forever; trigger it once after a known gap.

import type { SupabaseClient } from "@supabase/supabase-js";
import { channex } from "./channex";
import { applyRevision, type ApplyAction } from "./channex-bookings";

export interface RecoveryResult {
  ok: boolean;
  since: string;
  scanned: number;
  byAction: Record<ApplyAction, number> | Record<string, number>;
  errors: { bookingId: string; warning?: string }[];
  skipped?: string;
}

export async function recoverBookings(
  supabase: SupabaseClient,
  orgId: string,
  since: string
): Promise<RecoveryResult> {
  const byAction: Record<string, number> = {};
  const errors: { bookingId: string; warning?: string }[] = [];

  // Resolve the org's Channex property (the list endpoint is per-property).
  const { data: link } = await supabase
    .from("channel_provider_links")
    .select("channex_id")
    .eq("organization_id", orgId)
    .eq("kind", "property")
    .maybeSingle();
  const propertyId = (link as { channex_id: string } | null)?.channex_id;
  if (!propertyId) return { ok: false, since, scanned: 0, byAction, errors, skipped: "org not provisioned" };

  let scanned = 0;
  const MAX_PAGES = 100; // safety cap
  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageData = await channex.listBookings(propertyId, since, page);
    const items = pageData.data ?? [];
    if (items.length === 0) break;

    for (const booking of items) {
      scanned++;
      // A booking's attributes are a superset of a revision's — apply directly.
      // applyRevision dedupes by external_id, so already-imported bookings are
      // skipped, making this safe to re-run.
      const res = await applyRevision(supabase, booking.attributes);
      byAction[res.action] = (byAction[res.action] ?? 0) + 1;
      if (res.action === "error") errors.push({ bookingId: res.bookingId, warning: res.warning });
    }

    // Drained everything pending at fetch time.
    if (pageData.meta && page * pageData.meta.limit >= pageData.meta.total) break;
  }

  return { ok: errors.length === 0, since, scanned, byAction, errors };
}
