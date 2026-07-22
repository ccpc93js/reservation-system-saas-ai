-- Channex Phase 5: store an API-based OTA connection on the channels table.
-- A Channex OTA connection is a channels row with provider='channex': it holds
-- the Channex channel UUID, the OTA hotel id, and the live status so the UI can
-- show/manage it alongside iCal channels. iCal rows leave these null.
alter table public.channels
  add column if not exists channex_channel_id text,
  add column if not exists hotel_id text,
  add column if not exists channex_status text;

create index if not exists idx_channels_channex_channel
  on public.channels (channex_channel_id)
  where channex_channel_id is not null;

notify pgrst, 'reload schema';
