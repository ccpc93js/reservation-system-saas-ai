import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!membership) return Response.json({ error: "No organization" }, { status: 403 });

    const { data: channels, error } = await supabase
      .from("channels")
      .select("*, beds(id, name, rooms(id, name))")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false });

    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ channels });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!membership) return Response.json({ error: "No organization" }, { status: 403 });

    const body = await request.json();
    const { name, platform, ical_url, bed_id, color } = body;

    if (!name || !platform) {
      return Response.json({ error: "name and platform are required" }, { status: 400 });
    }

    const { data: channel, error } = await supabase
      .from("channels")
      .insert({
        organization_id: membership.organization_id,
        name,
        platform,
        ical_url: ical_url || null,
        bed_id: bed_id || null,
        color: color || "#6366f1",
      })
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ channel }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
