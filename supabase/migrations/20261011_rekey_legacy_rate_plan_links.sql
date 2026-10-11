-- Before multi-rate-plan support, channel_provider_links rows of
-- kind='rate_plan' were keyed by local_id = room_types.id (one rate plan per
-- room type, 1:1). The rate_plans migration (20261011_rate_plans.sql) backfilled
-- one default rate_plans row per room type with a brand-new id unrelated to
-- room_type_id, and provisionOrg now keys rate-plan links by rate_plans.id.
--
-- Without this fix, the next provisionOrg run for any already-provisioned org
-- would find no link under the new key, call channex.createRatePlan again,
-- and leave a duplicate, orphaned rate plan in Channex. Re-key every existing
-- rate_plan link from its room type's id to that room type's default rate
-- plan's id — the one-time migration from the old 1:1 identity to the new one.
--
-- Safe to run multiple times: the second run finds no row still keyed by a
-- room_type_id (they're all already re-keyed), so it's a no-op.
update public.channel_provider_links cpl
set local_id = rp.id::text,
    updated_at = now()
from public.room_types rt
join public.rate_plans rp on rp.room_type_id = rt.id and rp.is_default
where cpl.kind = 'rate_plan'
  and cpl.organization_id = rt.organization_id
  and cpl.local_id = rt.id::text;

notify pgrst, 'reload schema';
