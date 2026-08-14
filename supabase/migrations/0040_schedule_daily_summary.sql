-- Schedule daily-summary at 09:00 IST (03:30 UTC) — sends yesterday's
-- attendance + pending approvals summary to the owner.
select cron.schedule(
  'daily-summary',
  '30 3 * * *',
  $$select net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/daily-summary',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body:='{}'::jsonb
  ) as request_id;$$
);