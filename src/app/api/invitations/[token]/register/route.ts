import { createServiceClient } from "@/lib/supabase/server";

// New team member accepts an invite by SETTING A PASSWORD (no prior account).
// Creates a pre-verified auth user (the invite email is the proof of email
// ownership), the membership, and marks the invite accepted. The client then
// signs in with the same credentials.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { password, firstName } = await request.json();

    if (!password || typeof password !== "string" || password.length < 8) {
      return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const service = await createServiceClient();

    const { data: invitation, error } = await service
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !invitation) return Response.json({ error: "Invitation not found" }, { status: 404 });
    if (invitation.accepted_at) return Response.json({ error: "Invitation already accepted" }, { status: 410 });
    if (new Date(invitation.expires_at) < new Date()) return Response.json({ error: "Invitation expired" }, { status: 410 });

    const email = invitation.email.toLowerCase();

    // Guard: if an account already exists, this is the wrong flow — they must
    // sign in and accept instead.
    const { data: usersList } = await service.auth.admin.listUsers();
    const existing = usersList?.users.find((u) => u.email?.toLowerCase() === email);
    if (existing) {
      return Response.json(
        { error: "An account already exists for this email. Please sign in to accept.", code: "account_exists" },
        { status: 409 }
      );
    }

    // Create the pre-verified auth user.
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: firstName ? { first_name: firstName } : undefined,
    });
    if (createErr || !created?.user) {
      return Response.json({ error: createErr?.message || "Failed to create account" }, { status: 400 });
    }

    // Create membership with the invited role.
    const { error: memberError } = await service
      .from("memberships")
      .insert({
        organization_id: invitation.organization_id,
        user_id: created.user.id,
        role: invitation.role,
      });
    if (memberError) {
      // Roll back the auth user so the invite can be retried cleanly.
      await service.auth.admin.deleteUser(created.user.id);
      return Response.json({ error: memberError.message }, { status: 400 });
    }

    await service.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invitation.id);

    const { data: org } = await service
      .from("organizations")
      .select("slug")
      .eq("id", invitation.organization_id)
      .single();

    return Response.json({ success: true, email, slug: org?.slug });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
