alter table beds
  add column housekeeping_status text not null default 'clean'
    check (housekeeping_status in ('clean', 'dirty', 'inspected', 'out_of_order')),
  add column housekeeping_updated_at timestamptz not null default now(),
  add column housekeeping_updated_by uuid references auth.users(id);

alter publication supabase_realtime add table beds;
