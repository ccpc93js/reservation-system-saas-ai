-- Channex Phase 4: return availability as compressed ranges (gaps-and-islands),
-- not per-night rows. free_beds_calendar over a year is thousands of rows and
-- hits PostgREST's 1000-row cap; this collapses consecutive equal-availability
-- nights into one row per (room_type, run), so a year is a few rows per type.
create or replace function public.free_beds_ranges(
  p_organization_id uuid,
  p_from date,
  p_to date
) returns table(room_type_id uuid, date_from date, date_to date, free int)
language sql
stable
as $$
  with cal as (
    select c.room_type_id, c.d, c.free
    from public.free_beds_calendar(p_organization_id, p_from, p_to) c
  ),
  grp as (
    select room_type_id, d, free,
      -- consecutive dates with the same free value share a constant "island"
      (d - (row_number() over (partition by room_type_id, free order by d))::int) as island
    from cal
  )
  select room_type_id, min(d) as date_from, max(d) as date_to, free
  from grp
  group by room_type_id, free, island
  order by room_type_id, min(d);
$$;

notify pgrst, 'reload schema';
