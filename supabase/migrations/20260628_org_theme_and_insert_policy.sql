-- Org theme color for per-tenant branding
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS theme_color text DEFAULT '#7c3aed';

-- Allow any authenticated user to INSERT a new org (required for onboarding signup flow)
-- Existing UPDATE/SELECT policies remain. Service role bypasses RLS entirely.
CREATE POLICY organizations_insert_authenticated ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
