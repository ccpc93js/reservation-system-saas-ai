import { createServerClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import { STRIPE_PRICES } from "@/lib/plan";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { priceId, plan, required } = await request.json();
    if (!priceId || !plan) return Response.json({ error: "priceId and plan required" }, { status: 400 });

    // Validate priceId is one of ours
    const validPrices = Object.values(STRIPE_PRICES);
    if (!validPrices.includes(priceId)) {
      return Response.json({ error: "Invalid price" }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, organizations(id, name, slug, stripe_customer_id, stripe_subscription_id, plan)")
      .eq("user_id", user.id)
      .single();

    if (!membership) return Response.json({ error: "No organization" }, { status: 403 });

    const org = (membership as any).organizations;
    const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // If org already has an active subscription → update it (upgrade/downgrade)
    if (org.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      const itemId = subscription.items.data[0]?.id;
      if (!itemId) return Response.json({ error: "Subscription item not found" }, { status: 400 });

      await stripe.subscriptions.update(org.stripe_subscription_id, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: "always_invoice",
        metadata: { org_id: org.id, plan },
      });

      // Update plan immediately — webhook will also fire but this ensures instant UI update
      await supabase.from("organizations")
        .update({ plan, plan_updated_at: new Date().toISOString(), pending_plan: null })
        .eq("id", org.id);

      return Response.json({ upgraded: true });
    }

    // No existing subscription — create new checkout session
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: org.name,
        metadata: { org_id: org.id, user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", org.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: required
        ? `${origin}/${org.slug}/dashboard?welcome=1`
        : `${origin}/${org.slug}/settings/billing?success=1`,
      cancel_url: `${origin}/${org.slug}/settings/billing${required ? "?required=true" : ""}`,
      metadata: { org_id: org.id, plan },
      subscription_data: { metadata: { org_id: org.id, plan } },
      allow_promotion_codes: true,
    });

    return Response.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
