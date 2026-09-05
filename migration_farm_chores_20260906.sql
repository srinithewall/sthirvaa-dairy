-- Farm chores: schedule/reminder feature migration
-- Backup taken before running:
--   scratchpad/farm_activities_backup_20260906.sql  (farm_activities + farm_activity_logs)
--
-- Run the two parts in order. Part 1 is transactional; part 2 is DDL and self-commits.

-- ---------------------------------------------------------------------------
-- Part 1: collapse the duplicate weight routine.
--
-- Row 1 ("Bi-weekly Weight Measurement") is hand-made and owns the existing
-- occurrence history. Row 2 was seeded by SystemRoutineInitializer. Both resolve
-- to the same 1/15/30 schedule, so they generate two tasks on the same day.
-- Row 1 is kept and promoted to be the system routine; row 2 is removed.
-- ---------------------------------------------------------------------------
START TRANSACTION;

DELETE FROM farm_activity_logs WHERE activity_id = 2;
DELETE FROM farm_activities   WHERE id = 2 AND system_key = 'BIWEEKLY_HERD_WEIGHT';

UPDATE farm_activities
SET system_key              = 'BIWEEKLY_HERD_WEIGHT',
    action_route            = '/activities/weight-round',
    category                = 'HERD_CHECK',
    frequency               = 'BI_WEEKLY',
    days_of_month           = '1,15,30',
    due_time                = '08:00:00',
    reminder_enabled        = 1,
    reminder_interval_hours = 2,
    reminder_start_time     = '06:00:00',
    reminder_end_time       = '20:00:00',
    reminder_max_per_day    = 6,
    updated_at              = NOW()
WHERE id = 1;

-- Leftover routine from local endpoint testing (already deactivated).
DELETE FROM farm_activity_logs
 WHERE activity_id IN (SELECT id FROM (SELECT id FROM farm_activities WHERE title LIKE 'ZZ TEST%') t);
DELETE FROM farm_activities WHERE title LIKE 'ZZ TEST%';

COMMIT;

-- ---------------------------------------------------------------------------
-- Part 2: let the frequency column accept new values.
--
-- The column is a MySQL ENUM created before ONCE existed, and ddl-auto=update
-- never alters an existing column type - so creating a one-off routine fails
-- with "Data truncated for column 'frequency'". varchar means the next
-- frequency added in Java needs no migration at all.
-- ---------------------------------------------------------------------------
ALTER TABLE farm_activities MODIFY COLUMN frequency VARCHAR(20) NOT NULL;

-- ---------------------------------------------------------------------------
-- Verify: expect exactly one active weight routine, holding the system key.
-- ---------------------------------------------------------------------------
SELECT id, title, frequency, days_of_month, due_time, system_key, action_route, reminder_enabled, is_active
  FROM farm_activities ORDER BY id;

SHOW COLUMNS FROM farm_activities LIKE 'frequency';

SELECT id, activity_id, due_date, status FROM farm_activity_logs ORDER BY id;
