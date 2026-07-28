-- Extend the inbound-booking RPC: a PRIVATE room booking occupies the WHOLE
-- room (all its beds), not N pooled beds. When p_whole_room is true, pick a
-- room of the type with NO occupied bed for the dates and assign all its active
-- beds; return null if none is fully free (overbooking). Dorm path unchanged.
drop function if exists public.create_channex_reservation(uuid,uuid,text,text,date,date,text,uuid,int,numeric,numeric);

create function public.create_channex_reservation(
  p_organization_id uuid,
  p_guest_id uuid,
  p_channel_source text,
  p_external_id text,
  p_check_in date,
  p_check_out date,
  p_notes text,
  p_room_type_id uuid,
  p_quantity int,
  p_price_per_night numeric,
  p_total_price numeric,
  p_whole_room boolean default false
) returns uuid
language plpgsql
security definer
as $$
declare
  v_bed_ids uuid[];
  v_reservation_id uuid;
  v_bed_id uuid;
  v_room_id uuid;
  v_nights int := greatest(1, (p_check_out - p_check_in));
begin
  perform pg_advisory_xact_lock(hashtext(p_room_type_id::text));

  if p_whole_room then
    select r.id into v_room_id
    from rooms r
    where r.room_type_id = p_room_type_id
      and not exists (
        select 1 from beds b
        join reservation_items ri on ri.bed_id = b.id
        join reservations res on res.id = ri.reservation_id
        where b.room_id = r.id
          and ri.check_in < p_check_out and ri.check_out > p_check_in
          and res.status not in ('cancelled','no_show')
      )
    order by r.name
    limit 1;

    if v_room_id is null then
      return null;
    end if;

    select array_agg(id) into v_bed_ids
    from beds where room_id = v_room_id and is_active;
  else
    select array_agg(id) into v_bed_ids
    from (
      select b.id
      from beds b
      join rooms r on r.id = b.room_id
      where r.room_type_id = p_room_type_id
        and b.organization_id = p_organization_id
        and b.is_active
        and not exists (
          select 1 from reservation_items ri
          join reservations res on res.id = ri.reservation_id
          where ri.bed_id = b.id
            and ri.check_in < p_check_out and ri.check_out > p_check_in
            and res.status not in ('cancelled','no_show')
        )
      order by b.position nulls last, b.name
      limit p_quantity
    ) picked;

    if v_bed_ids is null or array_length(v_bed_ids, 1) < p_quantity then
      return null;
    end if;
  end if;

  if v_bed_ids is null or array_length(v_bed_ids, 1) < 1 then
    return null;
  end if;

  insert into reservations (
    organization_id, guest_id, channel_id, channel_source,
    external_id, external_sync_at, check_in, check_out,
    status, total_amount, paid_amount, notes
  ) values (
    p_organization_id, p_guest_id, null, p_channel_source,
    p_external_id, now(), p_check_in, p_check_out,
    'confirmed', coalesce(p_total_price, 0), 0, p_notes
  ) returning id into v_reservation_id;

  foreach v_bed_id in array v_bed_ids loop
    insert into reservation_items (
      organization_id, reservation_id, bed_id,
      check_in, check_out, price_per_night, total_price
    ) values (
      p_organization_id, v_reservation_id, v_bed_id,
      p_check_in, p_check_out,
      coalesce(p_price_per_night, 0),
      coalesce(p_price_per_night, 0) * v_nights
    );
  end loop;

  if p_guest_id is not null then
    insert into reservation_guests (organization_id, reservation_id, guest_id, is_primary)
    values (p_organization_id, v_reservation_id, p_guest_id, true)
    on conflict (reservation_id, guest_id) do nothing;
  end if;

  return v_reservation_id;
end;
$$;

notify pgrst, 'reload schema';
