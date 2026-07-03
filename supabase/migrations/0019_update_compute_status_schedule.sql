-- Update compute-attendance-status to run at 21:00 IST (15:30 UTC)
-- so it processes today's attendance after auto-checkout (20:00 IST)

SELECT cron.schedule(
  'compute-attendance-status',
  '30 15 * * *',
  $$SELECT net.http_post(url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/compute-attendance-status', headers:=jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')), body:='{}'::jsonb) AS request_id;$$
);
