SELECT cron.schedule(
  'scheduled-backup-check',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://nreslricievaamrwfrlx.supabase.co/functions/v1/scheduled-backup',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZXNscmljaWV2YWFtcndmcmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0Mjc3NTUsImV4cCI6MjA3MTAwMzc1NX0.xHf2lE2OGZ5jNGOBWGAsOdoyHqdwi_TxWkbKiAr1RJY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);