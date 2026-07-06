-- Phase B: room-type channel manager.
-- Channels can map to a room type (pool of beds) instead of a single bed.
-- free_beds() is the core availability primitive; the room-type OTA RPC
-- auto-assigns a free bed like real channel managers do, returning null on
-- overbooking so the caller can flag it. Both OTA RPCs now record the
-- primary guest in reservation_guests.
alter table public.channels
  add column if not exists room_type_id uuid references room_types(id) on delete set null,
  add column if not exists allotment integer,
  add column if not exists mapping_mode text not null default 'bed';
alter table public.channels drop constraint if exists channels_mapping_mode_check;
alter table public.channels add constraint channels_mapping_mode_check check (mapping_mode in ('bed','room_type'));
create index if not exists idx_channels_room_type on public.channels (room_type_id);

-- Core availability primitive: free beds in a room type for a date range.
create or replace function public.free_beds(p_room_type_id uuid, p_check_in date, p_check_out date)
returns integer
language sql stable
as $$
  select count(*)::int
  from beds b
  join rooms r on r.id = b.room_id
  where r.room_type_id = p_room_type_id
    and b.is_active
    and not exists (
      select 1 from reservation_items ri
      join reservations res on res.id = ri.reservation_id
      where ri.bed_id = b.id
        and ri.check_in < p_check_out
        and ri.check_out > p_check_in
        and res.status not in ('cancelled','no_show')
    );
$$;

-- Atomic OTA reservation for room-type channels: auto-assigns a free bed.
-- Returns null when no bed is free (overbooking — caller must flag/notify).
create or replace function public.create_ota_reservation_room_type(
  p_organization_id uuid,
  p_guest_id uuid,
  p_channel_id uuid,
  p_channel_source text,
  p_external_id text,
  p_check_in date,
  p_check_out date,
  p_notes text,
  p_room_type_id uuid
) returns uuid
language plpgsql
security definer
as $$
declare
  v_bed_id uuid;
  v_reservation_id uuid;
begin
  -- Serialize assignment per room type so concurrent syncs can't grab the same bed.
  perform pg_advisory_xact_lock(hashtext(p_room_type_id::text));

  select b.id into v_bed_id
  from beds b
  join rooms r on r.id = b.room_id
  where r.room_type_id = p_room_type_id
    and b.organization_id = p_organization_id
    and b.is_active
    and not exists (
      select 1 from reservation_items ri
      join reservations res on res.id = ri.reservation_id
      where ri.bed_id = b.id
        and ri.check_in < p_check_out
        and ri.check_out > p_check_in
        and res.status not in ('cancelled','no_show')
    )
  order by b.position nulls last, b.name
  limit 1;

  if v_bed_id is null then
    return null;
  end if;

  insert into reservations (
    organization_id, guest_id, channel_id, channel_source,
    external_id, external_sync_at, check_in, check_out,
    status, total_amount, paid_amount, notes
  ) values (
    p_organization_id, p_guest_id, p_channel_id, p_channel_source,
    p_external_id, now(), p_check_in, p_check_out,
    'confirmed', 0, 0, p_notes
  ) returning id into v_reservation_id;

  insert into reservation_items (
    organization_id, reservation_id, bed_id,
    check_in, check_out, price_per_night, total_price
  ) values (
    p_organization_id, v_reservation_id, v_bed_id,
    p_check_in, p_check_out, 0, 0
  );

  if p_guest_id is not null then
    insert into reservation_guests (organization_id, reservation_id, guest_id, is_primary)
    values (p_organization_id, v_reservation_id, p_guest_id, true)
    on conflict (reservation_id, guest_id) do nothing;
  end if;

  return v_reservation_id;
end;
$$;

-- Keep the legacy per-bed RPC in sync: record the primary guest too.
create or replace function public.create_ota_reservation(
  p_organization_id uuid,
  p_guest_id uuid,
  p_channel_id uuid,
  p_channel_source text,
  p_external_id text,
  p_check_in date,
  p_check_out date,
  p_notes text,
  p_bed_id uuid
) returns uuid
language plpgsql
security definer
as $$
declare
  v_reservation_id uuid;
begin
  insert into reservations (
    organization_id, guest_id, channel_id, channel_source,
    external_id, external_sync_at, check_in, check_out,
    status, total_amount, paid_amount, notes
  ) values (
    p_organization_id, p_guest_id, p_channel_id, p_channel_source,
    p_external_id, now(), p_check_in, p_check_out,
    'confirmed', 0, 0, p_notes
  ) returning id into v_reservation_id;

  insert into reservation_items (
    organization_id, reservation_id, bed_id,
    check_in, check_out, price_per_night, total_price
  ) values (
    p_organization_id, v_reservation_id, p_bed_id,
    p_check_in, p_check_out, 0, 0
  );

  if p_guest_id is not null then
    insert into reservation_guests (organization_id, reservation_id, guest_id, is_primary)
    values (p_organization_id, v_reservation_id, p_guest_id, true)
    on conflict (reservation_id, guest_id) do nothing;
  end if;

  return v_reservation_id;
end;
$$;

notify pgrst, 'reload schema';
