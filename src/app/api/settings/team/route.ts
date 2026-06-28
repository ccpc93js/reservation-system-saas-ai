import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: myMembership } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!myMembership) return Response.json({ error: "No organization" }, { status: 403 });

    const orgId = myMembership.organization_id;
    const service = await createServiceClient();

    // Get all members — join with auth.users via admin API
    const { data: memberships } = await service
      .from("memberships")
      .select("id, user_id, role, created_at")
      .eq("organization_id", orgId)
      .order("created_at");

    if (!memberships) return Response.json({ members: [], invitations: [] });

    // Fetch user emails from auth admin
    const userIds = memberships.map((m) => m.user_id);
    const userEmails: Record<string, string> = {};
    for (const uid of userIds) {
      const { data } = await service.auth.admin.getUserById(uid);
      if (data?.user) userEmails[uid] = data.user.email ?? "";
    }

    const members = memberships.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      email: userEmails[m.user_id] ?? "",
      created_at: m.created_at,
      is_self: m.user_id === user.id,
    }));

    // Pending invitations
    const { data: invitations } = await service
      .from("invitations")
      .select("id, email, role, created_at, expires_at, accepted_at")
      .eq("organization_id", orgId)
      .is("accepted_at", null)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    return Response.json({ members, invitations: invitations ?? [] });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
