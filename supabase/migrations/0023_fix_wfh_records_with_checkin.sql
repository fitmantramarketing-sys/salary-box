-- Fix records where is_wfh = true but check_in_time is not null.
-- If an employee checked in physically, the WFH flag should be cleared.
UPDATE attendance_records
SET is_wfh = false
WHERE is_wfh = true
  AND check_in_time IS NOT NULL;
