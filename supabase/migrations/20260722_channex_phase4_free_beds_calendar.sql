-- Channex Phase 4: availability (ARI) push helper.
-- Per-night free-bed count per room type over a date range, in one query, so
-- the ARI push doesn't fan out into thousands of free_beds() calls. A night d
-- is occupied on a bed if an active reservation_item covers it (check_in <= d
-- < check_out). free = active beds in the room type minus occupied beds.
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
    select rtt.id as room_type_id,
      (select count(*) from beds b
         join rooms r on r.id = b.room_id
        where r.room_type_id = rtt.id and b.is_active) as total
    from room_types rtt
    where rtt.organization_id = p_organization_id
  )
  select rt.room_type_id, dates.d,
    greatest(0, rt.total - (
      select count(distinct ri.bed_id)
      from reservation_items ri
      join reservations res on res.id = ri.reservation_id
      join beds b on b.id = ri.bed_id
      join rooms r on r.id = b.room_id
      where r.room_type_id = rt.room_type_id
        and res.status not in ('cancelled','no_show')
        and ri.check_in <= dates.d
        and ri.check_out > dates.d
    ))::int as free
  from rt cross join dates
  order by rt.room_type_id, dates.d;
$$;

notify pgrst, 'reload schema';
