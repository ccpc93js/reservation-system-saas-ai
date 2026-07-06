-- Per-occupant guest book: one registry row per guest on the reservation
-- (Serbian knjiga gostiju / eTurista require each occupant registered
-- individually). The registry stays an append-only snapshot log; stay
-- fields are duplicated per row by design.
alter table public.checkin_registry drop constraint if exists checkin_registry_reservation_id_key;
alter table public.checkin_registry add column if not exists is_primary boolean not null default true;
-- One row per (reservation, guest); legacy rows may have null guest_id.
create unique index if not exists checkin_registry_res_guest_uniq
  on public.checkin_registry (reservation_id, guest_id) where guest_id is not null;
notify pgrst, 'reload schema';
