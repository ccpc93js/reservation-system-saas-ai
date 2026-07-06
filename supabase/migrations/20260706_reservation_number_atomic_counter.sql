-- Prevent duplicate reservation numbers.
--
-- The old generate_reservation_number() used count(*)+1 of existing rows per
-- org/year, which duplicates on delete (count drops) and under concurrent
-- inserts (BEFORE INSERT trigger reads the same count). Replace it with an
-- atomic per-org/year counter that never reuses a number.

create table if not exists reservation_number_counters (
  organization_id uuid not null,
  year int not null,
  last_number int not null default 0,
  primary key (organization_id, year)
);

-- Seed from the current max suffix so new numbers continue above existing ones.
insert into reservation_number_counters (organization_id, year, last_number)
select organization_id,
       extract(year from created_at)::int as yr,
       max(split_part(reservation_number, '-', 3)::int) as mx
from reservations
where reservation_number ~ '^RES-\d{2}-\d+$'
group by organization_id, extract(year from created_at)::int
on conflict (organization_id, year)
do update set last_number = greatest(reservation_number_counters.last_number, excluded.last_number);

create or replace function generate_reservation_number(org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  yy text := to_char(now(), 'YY');
  yr int := extract(year from now())::int;
begin
  insert into reservation_number_counters (organization_id, year, last_number)
  values (org_id, yr, 1)
  on conflict (organization_id, year)
  do update set last_number = reservation_number_counters.last_number + 1
  returning last_number into n;
  return 'RES-' || yy || '-' || lpad(n::text, 4, '0');
end;
$$;

-- Fix pre-existing duplicates (keep the earliest of each group, renumber the rest).
with ranked as (
  select id, organization_id,
         row_number() over (partition by organization_id, reservation_number order by created_at, id) as rn
  from reservations
)
update reservations r
set reservation_number = generate_reservation_number(r.organization_id)
from ranked
where r.id = ranked.id and ranked.rn > 1;

-- Backstop: enforce uniqueness at the DB level.
alter table reservations
  add constraint reservations_org_number_unique unique (organization_id, reservation_number);
