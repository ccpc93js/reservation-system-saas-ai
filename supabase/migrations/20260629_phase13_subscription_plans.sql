-- Phase 13: Subscription plans
-- Adds Stripe billing columns to organizations

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer ON public.organizations (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orgs_plan ON public.organizations (plan);
