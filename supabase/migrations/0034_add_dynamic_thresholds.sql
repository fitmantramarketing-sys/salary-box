ALTER TABLE shifts
  ADD COLUMN half_day_threshold_minutes smallint NOT NULL DEFAULT 45,
  ADD COLUMN early_checkout_grace_minutes smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN shifts.half_day_threshold_minutes IS 'Minutes after grace period ends after which check-in becomes half_day (e.g. grace=15, half_day=45 → check-in ≥60min after start = half_day)';
COMMENT ON COLUMN shifts.early_checkout_grace_minutes IS 'Minutes before shift end tolerated without requiring an early_checkout_reason';
