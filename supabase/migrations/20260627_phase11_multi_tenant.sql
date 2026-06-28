-- Phase 11: Multi-Tenant SaaS
-- Adds extra org settings columns and invitations table

-- Extra org columns
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS check_in_time text DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS check_out_time text DEFAULT '11:00',
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'EUR';

-- Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  token uuid DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invitations_org ON public.invitations (organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations (email);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins (owner/manager) can manage invitations for their org
CREATE POLICY invitations_admin_manage ON public.invitations
  FOR ALL
  USING (public.is_org_admin(organization_id));
