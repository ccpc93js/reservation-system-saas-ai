-- Channels: migrate room_id → bed_id (channels link to beds, not rooms)
-- bed_id was added in the initial channels table; this migration is a no-op
-- if the table was created correctly from phase10. Kept for history.

-- Ensure bed_id FK exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'channels' AND column_name = 'bed_id'
  ) THEN
    ALTER TABLE public.channels ADD COLUMN bed_id uuid REFERENCES beds(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_channels_bed ON public.channels (bed_id);
  END IF;
END $$;
