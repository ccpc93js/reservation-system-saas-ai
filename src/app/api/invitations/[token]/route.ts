import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const service = await createServiceClient();

    const { data: invitation, error } = await service
      .from("invitations")
      .select("id, email, role, expires_at, accepted_at, organization_id, organizations(name, slug)")
      .eq("token", token)
      .single();

    if (error || !invitation) return Response.json({ error: "Invitation not found" }, { status: 404 });
    if (invitation.accepted_at) return Response.json({ error: "Invitation already accepted" }, { status: 410 });
    if (new Date(invitation.expires_at) < new Date()) return Response.json({ error: "Invitation expired" }, { status: 410 });

    // Does an account already exist for this email? Drives the invite page:
    // existing → "sign in to accept"; new → "set a password".
    const { data: usersList } = await service.auth.admin.listUsers();
    const existingUser = !!usersList?.users.some(
      (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
    );

    return Response.json({ invitation, existingUser });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return Response.json({ error: "You must be logged in to accept an invitation" }, { status: 401 });

    const service = await createServiceClient();

    const { data: invitation, error } = await service
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !invitation) return Response.json({ error: "Invitation not found" }, { status: 404 });
    if (invitation.accepted_at) return Response.json({ error: "Invitation already accepted" }, { status: 410 });
    if (new Date(invitation.expires_at) < new Date()) return Response.json({ error: "Invitation expired" }, { status: 410 });

    // Verify email matches (case-insensitive)
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return Response.json({
        error: `This invitation is for ${invitation.email}. Please sign in with that email.`
      }, { status: 403 });
    }

    // Check not already a member
    const { data: existing } = await service
      .from("memberships")
      .select("id")
      .eq("organization_id", invitation.organization_id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      await service.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invitation.id);
      const { data: org } = await service.from("organizations").select("slug").eq("id", invitation.organization_id).single();
      return Response.json({ success: true, already_member: true, slug: org?.slug });
    }

    // Create membership
    const { error: memberError } = await service
      .from("memberships")
      .insert({ organization_id: invitation.organization_id, user_id: user.id, role: invitation.role });

    if (memberError) return Response.json({ error: memberError.message }, { status: 400 });

    // Mark accepted
    await service.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invitation.id);

    // Return org slug so client can redirect to /{slug}/dashboard
    const { data: org } = await service
      .from("organizations")
      .select("slug")
      .eq("id", invitation.organization_id)
      .single();

    return Response.json({ success: true, slug: org?.slug });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
