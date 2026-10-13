-- Evidence log for inbound Channex booking revisions (certification requires
-- citing the revision_id Channex assigned to each new/modified/cancelled
-- event). Previously the webhook/feed poller used revision_id transiently
-- (fetch, apply, ack) and discarded it — once acked, Channex's own feed no
-- longer returns it either, so it was unrecoverable after the fact.
create table if not exists public.channex_revisions (
  id uuid default uuid_generate_v4() not null,
  revision_id text not null,
  booking_id text not null,
  action text not null,
  organization_id uuid,
  reservation_id uuid,
  warning text,
  received_at timestamptz not null default now(),
  constraint channex_revisions_pkey primary key (id),
  constraint channex_revisions_org_fkey foreign key (organization_id) references organizations(id) on delete set null,
  constraint channex_revisions_reservation_fkey foreign key (reservation_id) references reservations(id) on delete set null
);

create index if not exists idx_channex_revisions_booking_id on public.channex_revisions (booking_id);
create index if not exists idx_channex_revisions_org on public.channex_revisions (organization_id);

alter table public.channex_revisions enable row level security;
create policy channex_revisions_org_access on public.channex_revisions
  for all using (organization_id in (
    select memberships.organization_id from memberships where memberships.user_id = auth.uid()
  ));

notify pgrst, 'reload schema';
