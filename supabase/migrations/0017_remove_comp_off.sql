-- Remove comp-off module entirely
-- 1. Drop table (cascades triggers, indexes, RLS policies)
-- 2. Remove app_config key
-- 3. Unscheduled cron jobs

DROP TABLE IF EXISTS comp_off_requests CASCADE;

DELETE FROM app_config WHERE key = 'comp_off_expiry_days';

SELECT cron.unschedule('comp-off-expiry-alert');
SELECT cron.unschedule('comp-off-lapse');
