-- Schedule checkout-reminder every 15 minutes to catch employees
-- whose shift ends within the next 15 minutes but haven't checked out.
select cron.schedule(
  'checkout-reminder',
  '*/15 * * * *',
  $$select net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/checkout-reminder',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body:='{}'::jsonb
  ) as request_id;$$
);
