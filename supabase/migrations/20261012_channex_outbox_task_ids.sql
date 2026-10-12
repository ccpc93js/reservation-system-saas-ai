-- Channex returns a task id per API call; the outbox worker was collecting
-- these in memory (processOutbox's return value) but never persisting them,
-- so there was no way to look up the task id for a given push after the
-- fact (needed for Channex's certification form). Store them on the rows
-- that were actually sent.
alter table channex_outbox add column if not exists task_ids text[];
