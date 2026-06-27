-- Phase 10: Channel Manager
-- Creates channels table and adds channel tracking columns to reservations

CREATE TABLE IF NOT EXISTS public.channels (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  platform text NOT NULL,
  ical_url text,
  export_token uuid DEFAULT uuid_generate_v4() NOT NULL,
  color text DEFAULT '#6366f1' NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  last_synced_at timestamptz,
  last_error text,
  sync_count integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  bed_id uuid,
  CONSTRAINT channels_pkey PRIMARY KEY (id),
  CONSTRAINT channels_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT channels_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE SET NULL
);

-- RLS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY channels_org_access ON public.channels
  FOR ALL
  USING (organization_id IN (
    SELECT memberships.organization_id FROM memberships WHERE memberships.user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_channels_org ON public.channels (organization_id);
CREATE INDEX IF NOT EXISTS idx_channels_export_token ON public.channels (export_token);
CREATE INDEX IF NOT EXISTS idx_channels_bed ON public.channels (bed_id);
CREATE INDEX IF NOT EXISTS idx_channels_org_active ON public.channels (organization_id, is_active);

-- Add channel tracking columns to reservations
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS channel_id uuid REFERENCES channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel_source text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_sync_at timestamptz;

-- Atomic OTA reservation creation
CREATE OR REPLACE FUNCTION public.create_ota_reservation(
  p_organization_id uuid,
  p_guest_id uuid,
  p_channel_id uuid,
  p_channel_source text,
  p_external_id text,
  p_check_in date,
  p_check_out date,
  p_notes text,
  p_bed_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation_id uuid;
BEGIN
  INSERT INTO reservations (
    organization_id, guest_id, channel_id, channel_source,
    external_id, external_sync_at, check_in, check_out,
    status, total_amount, paid_amount, notes
  ) VALUES (
    p_organization_id, p_guest_id, p_channel_id, p_channel_source,
    p_external_id, now(), p_check_in, p_check_out,
    'confirmed', 0, 0, p_notes
  )
  RETURNING id INTO v_reservation_id;

  INSERT INTO reservation_items (
    organization_id, reservation_id, bed_id,
    check_in, check_out, price_per_night, total_price
  ) VALUES (
    p_organization_id, v_reservation_id, p_bed_id,
    p_check_in, p_check_out, 0, 0
  );

  RETURN v_reservation_id;
END;
$$;
