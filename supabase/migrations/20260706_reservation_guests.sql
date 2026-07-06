-- Multiple guests per reservation.
-- Join table between reservations and guests. One row per occupant.
-- The primary/lead guest (is_primary = true) mirrors reservations.guest_id,
-- which is kept as a denormalized pointer for existing email/list code.
CREATE TABLE IF NOT EXISTS public.reservation_guests (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  organization_id uuid NOT NULL,
  reservation_id uuid NOT NULL,
  guest_id uuid NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT reservation_guests_pkey PRIMARY KEY (id),
  CONSTRAINT reservation_guests_unique UNIQUE (reservation_id, guest_id),
  CONSTRAINT reservation_guests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT reservation_guests_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  CONSTRAINT reservation_guests_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE
);

ALTER TABLE public.reservation_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY reservation_guests_select ON public.reservation_guests
  FOR SELECT
  USING (organization_id IN (
    SELECT memberships.organization_id FROM memberships WHERE memberships.user_id = auth.uid()
  ));

CREATE POLICY reservation_guests_insert ON public.reservation_guests
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT memberships.organization_id FROM memberships WHERE memberships.user_id = auth.uid()
  ));

CREATE POLICY reservation_guests_delete ON public.reservation_guests
  FOR DELETE
  USING (organization_id IN (
    SELECT memberships.organization_id FROM memberships WHERE memberships.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_reservation_guests_org ON public.reservation_guests (organization_id);
CREATE INDEX IF NOT EXISTS idx_reservation_guests_reservation ON public.reservation_guests (reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_guests_guest ON public.reservation_guests (guest_id);

-- Backfill: every reservation that already has a guest_id gets a primary row.
INSERT INTO public.reservation_guests (organization_id, reservation_id, guest_id, is_primary)
SELECT r.organization_id, r.id, r.guest_id, true
FROM public.reservations r
WHERE r.guest_id IS NOT NULL
ON CONFLICT (reservation_id, guest_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
