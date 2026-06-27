-- Performance indexes for channel sync queries

-- Reservations: fast lookup by channel + external_id (dedup during sync)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_channel_external
  ON public.reservations (channel_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_external_id
  ON public.reservations (external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_channel_source
  ON public.reservations (organization_id, channel_source);

-- Reservation items: fast bed availability lookups
CREATE INDEX IF NOT EXISTS idx_reservation_items_bed
  ON public.reservation_items (bed_id, check_in, check_out);
