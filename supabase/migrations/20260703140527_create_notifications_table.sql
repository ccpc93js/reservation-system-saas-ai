create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  link text,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_read_at_idx on notifications (user_id, read_at, created_at desc);

alter table notifications enable row level security;

create policy "Users can view their own notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "Users can update read state on their own notifications"
  on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter publication supabase_realtime add table notifications;
