-- Move daily-summary from 09:00 IST (03:30 UTC) to 20:00 IST (14:30 UTC) —
-- now reports the same-day attendance summary in the evening.
select cron.unschedule(jobid := (select jobid from cron.job where jobname = 'daily-summary'));

select cron.schedule(
  'daily-summary',
  '30 14 * * *',
  $$select net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/daily-summary',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body:='{}'::jsonb
  ) as request_id;$$
);