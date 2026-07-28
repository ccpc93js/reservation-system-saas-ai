-- Channex: OTA booking modifications held for staff review.
-- When an OTA changes an existing booking (dates/price), Channex sends a
-- "modified" revision. Auto-applying date/room changes to a live calendar is
-- risky, so we park the proposed change here and let a manager apply or dismiss
-- it. One open row per booking (re-modifications overwrite the pending one).
create table if not exists public.channex_pending_mods (
  id uuid default uuid_generate_v4() not null,
  organization_id uuid not null,
  reservation_id uuid not null,
  booking_id text not null,
  ota_name text,
  ota_reservation_code text,
  new_check_in date,
  new_check_out date,
  new_amount numeric,
  status text not null default 'pending',
  created_at timestamptz default now() not null,
  resolved_at timestamptz,
  constraint channex_pending_mods_pkey primary key (id),
  constraint channex_pending_mods_status_check check (status in ('pending','applied','dismissed')),
  constraint channex_pending_mods_org_fkey foreign key (organization_id) references organizations(id) on delete cascade,
  constraint channex_pending_mods_res_fkey foreign key (reservation_id) references reservations(id) on delete cascade
);

create unique index if not exists idx_channex_pending_mods_open
  on public.channex_pending_mods (organization_id, booking_id)
  where status = 'pending';
create index if not exists idx_channex_pending_mods_org
  on public.channex_pending_mods (organization_id, status);

alter table public.channex_pending_mods enable row level security;
create policy channex_pending_mods_org_access on public.channex_pending_mods
  for all using (organization_id in (
    select memberships.organization_id from memberships where memberships.user_id = auth.uid()
  ));

notify pgrst, 'reload schema';
