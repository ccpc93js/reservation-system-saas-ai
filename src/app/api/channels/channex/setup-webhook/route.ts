import { createServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { channex, ChannexConfigError, type ChannexEntity } from "@/lib/channels/channex";
import { getSiteOrigin } from "@/lib/site-url";

// One-time-per-environment webhook registration for inbound bookings.
// Idempotent: registers the account-wide (property_id: null) booking webhook if
// it isn't already there, so re-running is safe. Manager-only, or cron via
// CRON_SECRET. The feed poller stays as the backstop regardless.
//
// POST   register (or report existing)
// DELETE remove our webhook(s)
// GET    status
//
// Note: Channex must be able to REACH the callback, so this refuses a localhost
// origin — run it against a deployed URL (NEXT_PUBLIC_SITE_URL / VERCEL_URL).

const WEBHOOK_PATH = "/api/channels/channex/webhook";
const EVENT_MASK = "booking_new;booking_modification;booking_cancellation";

async function authorize(request: Request): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return { ok: true };

  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false, status: 401, error: "Unauthorized" };
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (!membership || !isManager((membership as any).role)) return { ok: false, status: 403, error: "Forbidden" };
  return { ok: true };
}

function callbackBase(): string {
  return `${getSiteOrigin()}${WEBHOOK_PATH}`;
}

function callbackUrl(): string {
  const secret = process.env.CHANNEX_WEBHOOK_SECRET;
  return secret ? `${callbackBase()}?secret=${encodeURIComponent(secret)}` : callbackBase();
}

// Match our webhook by its callback path, ignoring the secret query (so a
// rotated secret still recognizes the existing hook).
function findOurs(hooks: ChannexEntity[]): ChannexEntity | undefined {
  const base = callbackBase();
  return hooks.find((h) => typeof (h.attributes as any)?.callback_url === "string" && (h.attributes as any).callback_url.startsWith(base));
}

export async function POST(request: Request) {
  try {
    const auth = await authorize(request);
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

    const origin = getSiteOrigin();
    if (origin.includes("localhost")) {
      return Response.json(
        { ok: false, error: "Refusing to register a localhost webhook — Channex can't reach it. Set NEXT_PUBLIC_SITE_URL to your public domain and re-run after deploy." },
        { status: 400 }
      );
    }
    if (!process.env.CHANNEX_WEBHOOK_SECRET) {
      return Response.json(
        { ok: false, error: "Set CHANNEX_WEBHOOK_SECRET before registering the webhook (the callback URL carries it to reject forged calls)." },
        { status: 400 }
      );
    }

    const hooks = await channex.listWebhooks();
    const existing = findOurs(hooks);
    if (existing) {
      return Response.json({ ok: true, already: true, id: existing.id, callback_url: (existing.attributes as any)?.callback_url });
    }

    const created = await channex.createWebhook({
      callback_url: callbackUrl(),
      event_mask: EVENT_MASK,
      is_global: true, // account-wide — covers every provisioned property
      is_active: true,
      send_data: false,
    });
    return Response.json({ ok: true, created: true, id: created.id, callback_url: callbackUrl() }, { status: 201 });
  } catch (err) {
    if (err instanceof ChannexConfigError) return Response.json({ error: err.message }, { status: 503 });
    console.error("Channex setup-webhook error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const auth = await authorize(request);
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    const hooks = await channex.listWebhooks();
    const ours = findOurs(hooks);
    return Response.json({
      ok: true,
      registered: !!ours,
      id: ours?.id ?? null,
      callback_url: ours ? (ours.attributes as any)?.callback_url : callbackUrl(),
      wouldRegister: callbackUrl(),
    });
  } catch (err) {
    if (err instanceof ChannexConfigError) return Response.json({ error: err.message }, { status: 503 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authorize(request);
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    const hooks = await channex.listWebhooks();
    const ours = findOurs(hooks);
    if (!ours) return Response.json({ ok: true, removed: false });
    await channex.deleteWebhook(ours.id);
    return Response.json({ ok: true, removed: true, id: ours.id });
  } catch (err) {
    console.error("Channex delete-webhook error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
