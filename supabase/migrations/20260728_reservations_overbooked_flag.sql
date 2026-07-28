-- Overbooked OTA bookings: a confirmed OTA booking that can't be placed (no free
-- bed/room) is still ingested — as an unassigned reservation flagged here — so
-- it's visible and staff can place it, rather than silently dropped.
alter table public.reservations
  add column if not exists overbooked boolean not null default false;

create index if not exists idx_reservations_overbooked
  on public.reservations (organization_id)
  where overbooked = true;

notify pgrst, 'reload schema';
