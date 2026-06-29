-- Unschedule stale cron functions that are no longer needed after the
-- leave balance overhaul (accrual → yearly allocation, no carry-forward, no comp-off).
-- Applied via Management API SQL on 2026-06-29.

SELECT cron.unschedule('monthly-leave-accrual');
SELECT cron.unschedule('year-end-leave-rollover');
SELECT cron.unschedule('carry-forward-expiry-alert');
SELECT cron.unschedule('carry-forward-lapse');
