-- Phase 14: Check-in registry
-- Permanent, append-only record of every guest who actually checked in.
-- Snapshotted at check-in time so later edits to guests/reservations never rewrite history.

CREATE TABLE IF NOT EXISTS public.checkin_registry (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  organization_id uuid NOT NULL,
  reservation_id uuid NOT NULL,
  guest_id uuid,
  reservation_number text,

  first_name text,
  last_name text,
  date_of_birth date,
  nationality text,
  country_of_birth text,
  place_of_birth text,
  document_type text,
  document_number text,
  document_issued_date date,
  document_issued_place text,
  document_expiry date,
  jmbg text,

  service_type text,
  room_name text,
  bed_name text,

  check_in date,
  check_out date,
  actual_check_in_at timestamptz,
  actual_check_out_at timestamptz,

  total_amount numeric DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  payment_currency text,

  created_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT checkin_registry_pkey PRIMARY KEY (id),
  CONSTRAINT checkin_registry_reservation_id_key UNIQUE (reservation_id),
  CONSTRAINT checkin_registry_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT checkin_registry_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
);

ALTER TABLE public.checkin_registry ENABLE ROW LEVEL SECURITY;

-- Members can read their org's registry
CREATE POLICY checkin_registry_select ON public.checkin_registry
  FOR SELECT
  USING (organization_id IN (
    SELECT memberships.organization_id FROM memberships WHERE memberships.user_id = auth.uid()
  ));

-- Members can insert (snapshot written once at check-in time)
CREATE POLICY checkin_registry_insert ON public.checkin_registry
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT memberships.organization_id FROM memberships WHERE memberships.user_id = auth.uid()
  ));

-- No UPDATE/DELETE policies: the registry is append-only by design.

CREATE INDEX IF NOT EXISTS idx_checkin_registry_org ON public.checkin_registry (organization_id);
CREATE INDEX IF NOT EXISTS idx_checkin_registry_reservation ON public.checkin_registry (reservation_id);
