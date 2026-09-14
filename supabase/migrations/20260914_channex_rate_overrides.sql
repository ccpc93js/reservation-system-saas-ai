-- Channex integration — Rate calendar: per-date rate/restriction overrides
-- Adds room_type_rate_overrides for per-date ARI overrides (rate, min/max
-- stay, stop sell, CTA/CTD) plus room_types.max_stay as the standing
-- (non-dated) max-stay restriction. Null override fields mean "inherit the
-- room type's standing value". See
-- docs/superpowers/specs/2026-09-14-rate-calendar-design.md.

create table if not exists public.room_type_rate_overrides (
  id uuid default uuid_generate_v4() not null,
  organization_id uuid not null,
  room_type_id uuid not null,
  date date not null,
  rate numeric,
  min_stay_arrival integer check (min_stay_arrival is null or min_stay_arrival > 0),
  min_stay_through integer check (min_stay_through is null or min_stay_through > 0),
  max_stay integer check (max_stay is null or max_stay > 0),
  stop_sell boolean,
  closed_to_arrival boolean,
  closed_to_departure boolean,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint room_type_rate_overrides_pkey primary key (id),
  constraint room_type_rate_overrides_org_fkey
    foreign key (organization_id) references organizations(id) on delete cascade,
  constraint room_type_rate_overrides_room_type_fkey
    foreign key (room_type_id) references room_types(id) on delete cascade,
  constraint room_type_rate_overrides_unique
    unique (room_type_id, date)
);

alter table public.room_type_rate_overrides enable row level security;

create policy room_type_rate_overrides_org_access on public.room_type_rate_overrides
  for all
  using (organization_id in (
    select memberships.organization_id from memberships where memberships.user_id = auth.uid()
  ));

create index if not exists idx_room_type_rate_overrides_org
  on public.room_type_rate_overrides (organization_id);
create index if not exists idx_room_type_rate_overrides_lookup
  on public.room_type_rate_overrides (room_type_id, date);

comment on table public.room_type_rate_overrides is 'Per-date rate/restriction overrides. Null field = inherit the room type''s standing value (base_price / stop_sell / etc). Compressed into date ranges only when pushed to Channex.';

alter table public.room_types
  add column max_stay integer check (max_stay is null or max_stay > 0);

comment on column public.room_types.max_stay is 'Channex ARI: maximum nights allowed for a stay. Null = no restriction.';

notify pgrst, 'reload schema';
