-- The beds PATCH route sets updated_at, but the column was missing, causing
-- "Could not find the 'updated_at' column of 'beds' in the schema cache".
alter table beds add column if not exists updated_at timestamptz not null default now();

notify pgrst, 'reload schema';
