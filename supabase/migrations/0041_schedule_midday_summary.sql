-- Schedule midday-summary at 10:30 IST (05:00 UTC) — sends today's check-in,
-- WFH, late status to the owner.
select cron.schedule(
  'midday-summary',
  '0 5 * * *',
  $$select net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/midday-summary',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body:='{}'::jsonb
  ) as request_id;$$
);