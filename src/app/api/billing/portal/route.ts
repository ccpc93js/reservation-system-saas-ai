import { createServerClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site-url";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("memberships")
      .select("organizations(stripe_customer_id, slug)")
      .eq("user_id", user.id)
      .single();

    const org = (membership as any)?.organizations;
    if (!org?.stripe_customer_id) {
      return Response.json({ error: "No active subscription found" }, { status: 400 });
    }

    const origin = getSiteOrigin();

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${origin}/${org.slug}/settings/billing`,
    });

    return Response.json({ url: session.url });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
