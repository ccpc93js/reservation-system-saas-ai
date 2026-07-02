import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site-url";

// Vercel automatically sends `Authorization: Bearer $CRON_SECRET` for cron jobs
// when CRON_SECRET is set in project env vars. Manual callers must do the same.
function isCronAuthed(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  try {
    const cronRequest = isCronAuthed(request);

    let orgIds: string[] = [];

    if (cronRequest) {
      const supabase = await createServiceClient();
      const { data: orgs } = await supabase.from("organizations").select("id");
      orgIds = (orgs || []).map((o) => o.id);
    } else {
      const supabase = await createServerClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

      const { data: membership } = await supabase
        .from("memberships")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();
      if (!membership) return Response.json({ error: "No organization" }, { status: 403 });
      orgIds = [(membership as any).organization_id];
    }

    const supabase = await createServiceClient();
    const allResults: any[] = [];

    const origin = getSiteOrigin();

    for (const orgId of orgIds) {
      const { data: channels } = await supabase
        .from("channels")
        .select("id, name")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .not("ical_url", "is", null);

      if (!channels || channels.length === 0) continue;

      // Forward auth header for cron; forward session cookies for user requests
      let extraHeaders: Record<string, string> = {};
      if (cronRequest) {
        extraHeaders["Authorization"] = `Bearer ${process.env.CRON_SECRET}`;
      } else {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        extraHeaders["Cookie"] = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
      }

      const CONCURRENCY = 3;
      const syncResults: any[] = [];
      for (let i = 0; i < channels.length; i += CONCURRENCY) {
        const batch = channels.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.allSettled(
          batch.map(async (ch) => {
            const res = await fetch(`${origin}/api/channels/${ch.id}/sync`, {
              method: "POST",
              headers: extraHeaders,
            });
            const data = await res.json();
            return { channel: ch.name, success: res.ok, ...(data.results || {}) };
          })
        );
        batchResults.forEach((r) => {
          if (r.status === "fulfilled") syncResults.push(r.value);
          else syncResults.push({ success: false, error: r.reason?.message || "Failed" });
        });
      }
      allResults.push(...syncResults);
    }

    const total = allResults.reduce(
      (acc, r) => ({
        created: acc.created + (r.created || 0),
        updated: acc.updated + (r.updated || 0),
        cancelled: acc.cancelled + (r.cancelled || 0),
      }),
      { created: 0, updated: 0, cancelled: 0 }
    );

    console.log(`[sync-all] ${cronRequest ? "CRON" : "USER"} — ${allResults.length} channels — created:${total.created} updated:${total.updated} cancelled:${total.cancelled}`);

    return Response.json({ success: true, results: allResults, total });
  } catch (err) {
    console.error("sync-all error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
