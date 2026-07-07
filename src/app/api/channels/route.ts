import { createServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";

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
      .select("*, beds(id, name, rooms(id, name)), room_types(id, name)")
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
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();
    if (!membership) return Response.json({ error: "No organization" }, { status: 403 });
    if (!isManager((membership as any).role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { name, platform, ical_url, bed_id, color, mapping_mode, room_type_id, allotment } = body;

    if (!name || !platform) {
      return Response.json({ error: "name and platform are required" }, { status: 400 });
    }
    const isRoomType = mapping_mode === "room_type";
    if (isRoomType && !room_type_id) {
      return Response.json({ error: "room_type_id is required for room-type channels" }, { status: 400 });
    }

    const { data: channel, error } = await supabase
      .from("channels")
      .insert({
        organization_id: membership.organization_id,
        name,
        platform,
        ical_url: ical_url || null,
        mapping_mode: isRoomType ? "room_type" : "bed",
        bed_id: isRoomType ? null : (bed_id || null),
        room_type_id: isRoomType ? room_type_id : null,
        allotment: isRoomType && allotment != null && allotment !== "" ? Number(allotment) : null,
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
