# Phase 9 Database Migration Instructions

## Apply Migration to Supabase

### Step 1: Access Supabase SQL Editor
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** in left sidebar
4. Click **New Query**

### Step 2: Copy Migration SQL
Copy all SQL from: `supabase/migrations/add_guest_portal_fields.sql`

Or run each statement individually:

```sql
-- Add new columns to reservations table
alter table reservations
add column if not exists check_in_token uuid unique default uuid_generate_v4();

alter table reservations
add column if not exists self_check_in_submitted_at timestamptz;

alter table reservations
add column if not exists self_check_in_data jsonb;

alter table reservations
add column if not exists id_photos jsonb;

alter table reservations
add column if not exists check_in_verified_at timestamptz;

alter table reservations
add column if not exists check_in_verified_by uuid references auth.users(id) on delete set null;

-- Add indexes for performance
create index if not exists idx_reservations_check_in_token on reservations(check_in_token);
create index if not exists idx_reservations_self_check_in on reservations(organization_id, self_check_in_submitted_at desc);
```

### Step 3: Execute Migration
1. Paste SQL into editor
2. Click **Run** (or Ctrl+Enter)
3. Wait for success message: "Success. No rows returned"

### Step 4: Verify Columns Added
```sql
-- Check new columns exist
select column_name, data_type
from information_schema.columns
where table_name = 'reservations'
and column_name in (
  'check_in_token',
  'self_check_in_submitted_at',
  'self_check_in_data',
  'id_photos',
  'check_in_verified_at',
  'check_in_verified_by'
);
```

Expected result: 6 rows with column names and their types

### Step 5: Verify Indexes
```sql
-- Check indexes exist
select indexname
from pg_indexes
where tablename = 'reservations'
and indexname like 'idx_reservations_%';
```

Expected result: Should include new indexes

## Update Storage Bucket (Optional)

Phase 9 stores ID photos in Supabase Storage. Verify bucket exists:

1. Go to **Storage** in Supabase Dashboard
2. Look for `guest-check-ins` bucket
3. If missing, create it:
   - Click **New Bucket**
   - Name: `guest-check-ins`
   - Public (to serve images)
   - Click **Create Bucket**

## Environment Variables (Optional)

No new environment variables needed. Email notifications currently log to console.

To integrate real email service later:
- `RESEND_API_KEY` (for Resend.com)
- `SENDGRID_API_KEY` (for SendGrid)
- `SMTP_HOST`, `SMTP_PORT`, etc. (for custom SMTP)

## Rollback (If Needed)

To remove Phase 9 changes:

```sql
-- Drop indexes
drop index if exists idx_reservations_check_in_token;
drop index if exists idx_reservations_self_check_in;

-- Remove columns
alter table reservations drop column if exists check_in_token;
alter table reservations drop column if exists self_check_in_submitted_at;
alter table reservations drop column if exists self_check_in_data;
alter table reservations drop column if exists id_photos;
alter table reservations drop column if exists check_in_verified_at;
alter table reservations drop column if exists check_in_verified_by;
```

## Testing

After migration:
1. Run dev server: `npm run dev`
2. Follow test checklist in `PHASE_9_TESTING.md`
3. Create test guest + reservation
4. Test guest portal link
5. Test staff verification

## Notes

- Migration uses `if not exists` clauses (safe to run multiple times)
- New columns default to NULL (backward compatible)
- No data loss if rolled back
- Indexes improve query performance for pending check-in list
