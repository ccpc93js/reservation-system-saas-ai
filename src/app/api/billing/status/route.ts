import { createServerClient } from "@/lib/supabase/server";
import { getPlanLimits } from "@/lib/plan";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, role, organizations(id, plan, plan_expires_at, stripe_customer_id, stripe_subscription_id)")
      .eq("user_id", user.id)
      .single();

    if (!membership) return Response.json({ error: "No organization" }, { status: 403 });

    const org = (membership as any).organizations;
    const orgId = org.id;
    const plan = org.plan ?? "free";
    const limits = getPlanLimits(plan);

    // Fetch usage counts
    const [{ count: bedCount }, { count: userCount }] = await Promise.all([
      supabase.from("beds").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("memberships").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    ]);

    return Response.json({
      plan,
      limits,
      usage: {
        beds: { current: bedCount ?? 0, max: limits.beds },
        users: { current: userCount ?? 0, max: limits.users },
      },
      stripe_customer_id: org.stripe_customer_id,
      stripe_subscription_id: org.stripe_subscription_id,
      plan_expires_at: org.plan_expires_at,
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
