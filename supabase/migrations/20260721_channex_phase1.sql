-- Channex integration — Phase 1: schema & provider plumbing
-- Adds a second connection provider ('channex') alongside the existing iCal
-- channels, and a mapping table for the Channex-assigned UUIDs. Existing iCal
-- rows are untouched (default 'ical'). See
-- docs/plans/2026-07-07-channex-implementation-plan.md, Phase 1.

-- 1. Tag each channel with its provider. Existing rows -> 'ical'.
alter table public.channels
  add column if not exists provider text not null default 'ical';

alter table public.channels
  drop constraint if exists channels_provider_check;
alter table public.channels
  add constraint channels_provider_check check (provider in ('ical', 'channex'));

create index if not exists idx_channels_org_provider
  on public.channels (organization_id, provider);

-- 2. Mapping table: (kind, local_id) -> channex_id, per org. Idempotent upsert
--    target for the content sync (property/room_type/rate_plan) and later the
--    booking dedupe (kind = 'booking', local_id = reservation id).
--    For kind = 'property' there is no local row, so local_id carries the
--    organization id string, keeping the (org, kind, local_id) unique.
create table if not exists public.channel_provider_links (
  id uuid default uuid_generate_v4() not null,
  organization_id uuid not null,
  kind text not null,
  local_id text not null,
  channex_id text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint channel_provider_links_pkey primary key (id),
  constraint channel_provider_links_kind_check
    check (kind in ('property', 'room_type', 'rate_plan', 'booking')),
  constraint channel_provider_links_org_fkey
    foreign key (organization_id) references organizations(id) on delete cascade,
  constraint channel_provider_links_unique
    unique (organization_id, kind, local_id)
);

alter table public.channel_provider_links enable row level security;

create policy channel_provider_links_org_access on public.channel_provider_links
  for all
  using (organization_id in (
    select memberships.organization_id from memberships where memberships.user_id = auth.uid()
  ));

create index if not exists idx_channel_provider_links_org
  on public.channel_provider_links (organization_id);
create index if not exists idx_channel_provider_links_lookup
  on public.channel_provider_links (organization_id, kind, local_id);
-- Reverse lookup: inbound revisions arrive keyed by channex_id (booking dedupe,
-- cancellation lookup).
create index if not exists idx_channel_provider_links_channex
  on public.channel_provider_links (kind, channex_id);

notify pgrst, 'reload schema';
