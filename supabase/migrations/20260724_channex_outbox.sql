-- Channex ARI outbox. Certification requires that PMS save-handlers do NOT call
-- the Channex API directly; they enqueue a change here, and a rate-limited
-- worker batches pending rows per (org, kind) into single availability /
-- restrictions calls, with retry/backoff. This is the queue + limiter the live
-- review checks for, and it keeps pushes as deltas (a row scopes a window +
-- optional room types).
create table if not exists public.channex_outbox (
  id uuid default uuid_generate_v4() not null,
  organization_id uuid not null,
  kind text not null,
  from_date date not null,
  to_date date not null,
  room_type_ids text[],          -- null = all provisioned room types
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  created_at timestamptz default now() not null,
  sent_at timestamptz,
  constraint channex_outbox_pkey primary key (id),
  constraint channex_outbox_kind_check check (kind in ('availability','restrictions')),
  constraint channex_outbox_status_check check (status in ('pending','sent','error')),
  constraint channex_outbox_org_fkey foreign key (organization_id) references organizations(id) on delete cascade
);

create index if not exists idx_channex_outbox_due
  on public.channex_outbox (status, next_attempt_at);
create index if not exists idx_channex_outbox_org
  on public.channex_outbox (organization_id, kind, status);

alter table public.channex_outbox enable row level security;
create policy channex_outbox_org_access on public.channex_outbox
  for all using (organization_id in (
    select memberships.organization_id from memberships where memberships.user_id = auth.uid()
  ));

notify pgrst, 'reload schema';
