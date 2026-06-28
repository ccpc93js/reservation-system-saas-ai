import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();
    if (!membership) return Response.json({ error: "No organization" }, { status: 403 });
    if (!["owner", "manager", "admin"].includes(membership.role)) {
      return Response.json({ error: "Only admins can invite team members" }, { status: 403 });
    }

    const { email, role = "staff" } = await request.json();
    if (!email) return Response.json({ error: "Email required" }, { status: 400 });

    const service = await createServiceClient();
    const orgId = membership.organization_id;

    // Check if user is already a member
    const { data: existing } = await service.auth.admin.listUsers();
    const existingUser = existing?.users.find((u) => u.email === email);
    if (existingUser) {
      const { data: existingMember } = await service
        .from("memberships")
        .select("id")
        .eq("organization_id", orgId)
        .eq("user_id", existingUser.id)
        .single();
      if (existingMember) return Response.json({ error: "User is already a member" }, { status: 409 });
    }

    // Cancel any existing pending invite for same email+org
    await service
      .from("invitations")
      .delete()
      .eq("organization_id", orgId)
      .eq("email", email)
      .is("accepted_at", null);

    // Create invitation
    const { data: invitation, error: invErr } = await service
      .from("invitations")
      .insert({ organization_id: orgId, email, role, invited_by: user.id })
      .select()
      .single();

    if (invErr) return Response.json({ error: invErr.message }, { status: 400 });

    // Get org name for email
    const { data: org } = await service
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    // Send invite email via Resend
    const origin = process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const inviteUrl = `${origin}/invite/${invitation.token}`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "noreply@resend.dev",
        to: email,
        subject: `You're invited to join ${org?.name ?? "a property"} on HostMagSmart`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2>You've been invited!</h2>
            <p>You've been invited to join <strong>${org?.name ?? "a property"}</strong> as <strong>${role}</strong>.</p>
            <p>Click the button below to accept the invitation. This link expires in 7 days.</p>
            <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0">
              Accept Invitation
            </a>
            <p style="color:#666;font-size:12px">Or copy this link: ${inviteUrl}</p>
          </div>
        `,
      }),
    }).catch(() => null); // non-blocking — invite still created even if email fails

    return Response.json({ invitation }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
