-- Make availability per-type: a DORM's sellable unit is a bed (free beds), a
-- PRIVATE room's unit is the whole room (free rooms). This matches how each is
-- provisioned in Channex (dorm count_of_rooms = beds; private count_of_rooms =
-- rooms), fixing private rooms pushing bed-count as availability (overbooking).
-- A private room is occupied on a night if ANY of its beds has an active
-- reservation that night.
create or replace function public.free_beds_calendar(
  p_organization_id uuid,
  p_from date,
  p_to date
) returns table(room_type_id uuid, d date, free int)
language sql
stable
as $$
  with dates as (
    select generate_series(p_from, p_to - 1, interval '1 day')::date as d
  ),
  rt as (
    select rtt.id as room_type_id, rtt.type,
      (select count(*) from beds b join rooms r on r.id = b.room_id
        where r.room_type_id = rtt.id and b.is_active) as total_beds,
      (select count(*) from rooms r where r.room_type_id = rtt.id) as total_rooms
    from room_types rtt
    where rtt.organization_id = p_organization_id
  )
  select rt.room_type_id, dates.d,
    case when rt.type = 'dorm' then
      greatest(0, rt.total_beds - (
        select count(distinct ri.bed_id)
        from reservation_items ri
        join reservations res on res.id = ri.reservation_id
        join beds b on b.id = ri.bed_id
        join rooms r on r.id = b.room_id
        where r.room_type_id = rt.room_type_id
          and res.status not in ('cancelled','no_show')
          and ri.check_in <= dates.d and ri.check_out > dates.d
      ))
    else
      greatest(0, rt.total_rooms - (
        select count(distinct r.id)
        from rooms r
        where r.room_type_id = rt.room_type_id
          and exists (
            select 1 from beds b
            join reservation_items ri on ri.bed_id = b.id
            join reservations res on res.id = ri.reservation_id
            where b.room_id = r.id
              and res.status not in ('cancelled','no_show')
              and ri.check_in <= dates.d and ri.check_out > dates.d
          )
      ))
    end::int as free
  from rt cross join dates
  order by rt.room_type_id, dates.d;
$$;

notify pgrst, 'reload schema';
