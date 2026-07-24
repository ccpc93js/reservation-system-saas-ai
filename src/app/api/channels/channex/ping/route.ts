import { createServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { channex, ChannexConfigError, ChannexError } from "@/lib/channels/channex";

// Phase 1 connectivity check: confirms CHANNEX_API_KEY reaches the configured
// Channex environment (GET /properties → 200). Manager-only. Verify the
// integration is wired before building provisioning on top of it.
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();
    if (!membership) return Response.json({ error: "No organization" }, { status: 403 });
    if (!isManager((membership as any).role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const properties = await channex.listProperties();
    return Response.json({
      ok: true,
      baseUrl: (process.env.CHANNEX_BASE_URL || "https://staging.channex.io/api/v1"),
      propertyCount: Array.isArray(properties) ? properties.length : 0,
    });
  } catch (err) {
    if (err instanceof ChannexConfigError) {
      return Response.json({ ok: false, error: err.message }, { status: 503 });
    }
    if (err instanceof ChannexError) {
      return Response.json({ ok: false, error: err.message, status: err.status }, { status: 502 });
    }
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
