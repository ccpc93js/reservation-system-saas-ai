-- Multi-rate-plan support. Splits room_types' pricing/restriction columns
-- into a new rate_plans table (one room type -> many rate plans), re-keys
-- room_type_rate_overrides onto rate_plan_id, and adds touched_fields to
-- channex_outbox for sparse (partial) restriction pushes. See
-- docs/superpowers/specs/2026-10-11-multi-rate-plan-support-design.md.
--
-- room_types' own base_price/stop_sell/closed_to_arrival/closed_to_departure/
-- min_stay_arrival/min_stay_through/max_stay columns are left in place
-- (read-only from here on) — dropped in a follow-up cleanup migration once
-- this has run in production for a while.

create table public.rate_plans (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  room_type_id uuid not null references public.room_types(id) on delete cascade,
  name text not null,
  base_price numeric not null,
  stop_sell boolean not null default false,
  min_stay_arrival integer check (min_stay_arrival is null or min_stay_arrival > 0),
  min_stay_through integer check (min_stay_through is null or min_stay_through > 0),
  max_stay integer check (max_stay is null or max_stay > 0),
  closed_to_arrival boolean not null default false,
  closed_to_departure boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index rate_plans_one_default_per_room_type
  on public.rate_plans (room_type_id) where is_default;

create index idx_rate_plans_org on public.rate_plans (organization_id);
create index idx_rate_plans_room_type on public.rate_plans (room_type_id);

alter table public.rate_plans enable row level security;

create policy rate_plans_org_access on public.rate_plans
  for all
  using (organization_id in (
    select memberships.organization_id from memberships where memberships.user_id = auth.uid()
  ));

comment on table public.rate_plans is 'Named, independently-priced/restricted ways to sell a room type (e.g. "Best Available Rate", "Bed & Breakfast"). Each maps to its own Channex rate plan via channel_provider_links.';

-- Backfill: every existing room type gets exactly one default rate plan,
-- carrying its current standing values verbatim.
insert into public.rate_plans (
  organization_id, room_type_id, name, base_price, stop_sell,
  min_stay_arrival, min_stay_through, max_stay,
  closed_to_arrival, closed_to_departure, is_default
)
select
  organization_id, id, 'Standard Rate', base_price, stop_sell,
  min_stay_arrival, min_stay_through, max_stay,
  closed_to_arrival, closed_to_departure, true
from public.room_types;

-- room_type_rate_overrides: re-key from room_type_id to rate_plan_id.
alter table public.room_type_rate_overrides
  add column rate_plan_id uuid references public.rate_plans(id) on delete cascade;

update public.room_type_rate_overrides o
  set rate_plan_id = rp.id
  from public.rate_plans rp
  where rp.room_type_id = o.room_type_id and rp.is_default;

alter table public.room_type_rate_overrides
  alter column rate_plan_id set not null;

alter table public.room_type_rate_overrides
  drop constraint room_type_rate_overrides_unique;

alter table public.room_type_rate_overrides
  add constraint room_type_rate_overrides_unique unique (rate_plan_id, date);

create index if not exists idx_room_type_rate_overrides_rate_plan_lookup
  on public.room_type_rate_overrides (rate_plan_id, date);

comment on column public.room_type_rate_overrides.rate_plan_id is 'The specific rate plan this override applies to. room_type_id is kept (denormalized) so existing room-type-scoped queries keep working without a join.';

-- channex_outbox: track which restriction fields an edit touched, so the
-- worker can send a sparse (partial) payload instead of a full snapshot.
-- Null = unknown/everything (every pre-existing row, and availability rows
-- which don't use this column at all).
alter table public.channex_outbox add column touched_fields text[];

comment on column public.channex_outbox.touched_fields is 'Restriction field names this edit touched (rate, stop_sell, min_stay_arrival, etc). Null = send every field (full sync). Only meaningful for kind=restrictions rows.';

notify pgrst, 'reload schema';
