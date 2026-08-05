-- Add WFH start/end time tracking to attendance_records.
-- WFH days keep is_wfh = true + status work_from_home, with their own clock.

alter table attendance_records
  add column if not exists wfh_start_time timestamptz,
  add column if not exists wfh_end_time timestamptz;
