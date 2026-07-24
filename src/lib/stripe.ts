import Stripe from "stripe";

// Lazily constructed Stripe client. Building it at module load throws when
// STRIPE_SECRET_KEY is absent (e.g. Vercel's build-time page-data collection,
// or a preview env without the secret), which fails the whole build. Construct
// on first use inside a request handler instead.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key);
  }
  return _stripe;
}
