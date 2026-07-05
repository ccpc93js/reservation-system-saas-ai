import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { PRICE_TO_PLAN } from "@/lib/plan";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Safety net for the payment gate: the webhook (checkout.session.completed) is
// the primary path that clears `pending_plan` and sets `plan`, but if it is
// delayed or misconfigured the tenant gets stuck in a redirect loop
// (dashboard-layout gate → billing?required=true → auto-checkout → Stripe …).
// Whenever an org still has a pending_plan, we check Stripe directly for an
// active subscription and apply it. Only runs while pending_plan is set, so it
// does not add Stripe calls to normal page loads.
export async function reconcilePendingPlan(org: {
  id: string;
  pending_plan?: string | null;
  stripe_customer_id?: string | null;
}): Promise<string | null> {
  if (!org.pending_plan || !org.stripe_customer_id) return null;

  try {
    const subs = await stripe.subscriptions.list({
      customer: org.stripe_customer_id,
      status: "all",
      limit: 5,
    });
    const active = subs.data.find((s) => s.status === "active" || s.status === "trialing");
    if (!active) return null;

    const priceId = active.items.data[0]?.price.id ?? "";
    const plan = PRICE_TO_PLAN[priceId] ?? null;
    if (!plan) return null;

    const service = await createServiceClient();
    await service
      .from("organizations")
      .update({
        plan,
        stripe_subscription_id: active.id,
        pending_plan: null,
        plan_updated_at: new Date().toISOString(),
      })
      .eq("id", org.id);

    return plan;
  } catch (err) {
    console.error("[billing] reconcilePendingPlan failed:", err);
    return null;
  }
}
