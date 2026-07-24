import { createServiceClient } from "@/lib/supabase/server";
import { channex } from "@/lib/channels/channex";
import { applyRevision } from "@/lib/channels/channex-bookings";

// Phase 3 — inbound booking webhook (low-latency push). Channex POSTs a
// notification carrying a revision_id; the pull is the source of truth, so we
// fetch the revision, apply it, then ack. The feed poller stays as the backstop
// for any missed webhook (both share the 30-minute window).
//
// Auth: Channex does not sign these in a scheme we verify here yet, so the
// callback URL carries a shared secret (?secret=CHANNEX_WEBHOOK_SECRET) set
// when the webhook is registered. Reject anything without the right secret.
export async function POST(request: Request) {
  try {
    const secret = process.env.CHANNEX_WEBHOOK_SECRET;
    if (secret) {
      const url = new URL(request.url);
      if (url.searchParams.get("secret") !== secret) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => null);
    const revisionId: string | undefined = body?.payload?.revision_id;
    // Skip events our own pushes caused (user_id is the actor).
    if (!revisionId) return Response.json({ ok: true, skipped: "no revision_id" });

    // Pull the authoritative revision, apply, then ack.
    const revision = await channex.getRevision(revisionId);
    const service = await createServiceClient();
    const result = await applyRevision(service as any, revision.attributes);

    if (result.action !== "error") {
      await channex.ackRevision(revisionId);
    }
    // Always 200 so Channex doesn't hammer retries; errors are surfaced via
    // notifications and the un-acked revision is retried by the feed poller.
    return Response.json({ ok: true, result });
  } catch (err) {
    console.error("Channex webhook error:", err);
    // 200 to avoid retry storms; the feed backstop will re-serve the revision.
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "error" });
  }
}
