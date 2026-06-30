import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { PRICE_TO_PLAN } from "@/lib/plan";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) return new Response("No signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("Webhook signature failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const service = await createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const orgId = session.metadata?.org_id;
        const plan = session.metadata?.plan;
        if (!orgId || !plan) break;

        await service.from("organizations").update({
          plan,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          plan_expires_at: null,
          plan_updated_at: new Date().toISOString(),
          pending_plan: null,
        }).eq("id", orgId);

        console.log(`[stripe] checkout.session.completed — org ${orgId} → ${plan}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as any).subscription as string;
        if (!subId) break;

        const subscription = await stripe.subscriptions.retrieve(subId);
        const orgId = subscription.metadata?.org_id;
        const priceId = subscription.items.data[0]?.price.id;
        const plan = PRICE_TO_PLAN[priceId] ?? "free";

        if (!orgId) break;

        await service.from("organizations").update({
          plan,
          plan_expires_at: null,
          plan_updated_at: new Date().toISOString(),
        }).eq("id", orgId);

        console.log(`[stripe] invoice.payment_succeeded — org ${orgId} → ${plan}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.org_id;
        if (!orgId) break;

        const priceId = subscription.items.data[0]?.price.id;
        const plan = PRICE_TO_PLAN[priceId] ?? "free";
        const cancelAt = subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000).toISOString()
          : null;

        await service.from("organizations").update({
          plan,
          stripe_subscription_id: subscription.id,
          plan_expires_at: cancelAt,
          plan_updated_at: new Date().toISOString(),
        }).eq("id", orgId);

        console.log(`[stripe] subscription.updated — org ${orgId} → ${plan}, expires: ${cancelAt}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.org_id;
        if (!orgId) break;

        await service.from("organizations").update({
          plan: "free",
          stripe_subscription_id: null,
          plan_expires_at: null,
          plan_updated_at: new Date().toISOString(),
        }).eq("id", orgId);

        console.log(`[stripe] subscription.deleted — org ${orgId} → free`);
        break;
      }

      default:
        console.log(`[stripe] unhandled event: ${event.type}`);
    }
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return new Response("Webhook processing failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}

// Stripe requires raw body — disable Next.js body parsing
export const config = { api: { bodyParser: false } };
