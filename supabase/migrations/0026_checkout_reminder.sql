-- Track when the last checkout reminder was sent (prevents spam every 15 min)
alter table attendance_records add column if not exists checkout_reminder_sent_at timestamptz;
