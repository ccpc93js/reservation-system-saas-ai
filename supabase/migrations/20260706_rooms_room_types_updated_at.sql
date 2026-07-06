-- Same missing-column issue as beds: the rooms and room_types PATCH routes set
-- updated_at but the columns were missing ("Could not find the 'updated_at'
-- column ... in the schema cache").
alter table rooms add column if not exists updated_at timestamptz not null default now();
alter table room_types add column if not exists updated_at timestamptz not null default now();

notify pgrst, 'reload schema';
