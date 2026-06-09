# BUSINESS_RULES.md
## Internal HR Tool — Business Rules & Logic Specification
**Source of truth:** HR_Tool_PRD_v1 (June 2026)
**Status:** Implementation-ready specification. No code.

---

## Overview

This document captures all business rules, validation logic, computation formulas, state machine transitions, edge case handling, and scheduled job specifications. All rules here must be enforced in Supabase Edge Functions or database-level constraints — never only in the frontend.

Rules are grouped by domain.

---

## 1. Employee Management Rules

---

### BR-EMP-01 — Employee Code Generation
- Format: `EMP-{YYYY}-{NNNN}` where YYYY = current year, NNNN = zero-padded sequential number within that year
- Example: `EMP-2026-0001`, `EMP-2026-0012`
- Generated server-side on INSERT to `employees`
- Must be unique. Never reused, even for rehires.
- On rehire: new employee_code generated. Old code preserved in `previous_employee_id` reference.

### BR-EMP-02 — Duplicate PAN / Aadhar Detection
- On adding a document of type `pan` or `aadhar`: check if another active employee already has a document with the same type and file that matches (implement via a hash of the document on upload, stored as a separate `document_hash` column).
- If duplicate found: block insert, return error with existing employee code.
- Override: Owner can proceed with duplicate by providing a justification reason, which is logged to `audit_logs` with action `PAN_DUPLICATE_OVERRIDE`.

### BR-EMP-03 — Future Joiner Visibility
- Employees with `employment_status = 'future_joiner'` (i.e. `join_date > today`) are:
  - Visible to Owner: yes (full access)
  - Visible to HR: no (hidden until join_date)
  - Visible to Employee: no
  - Visible to System Admin: no (same restriction as HR — hidden until join_date)
- RLS condition: `employment_status != 'future_joiner' OR join_date <= current_date OR get_my_role() = 'owner'`
- On `join_date` reaching today: a scheduled Edge Function updates `employment_status` from `future_joiner` to `active` and triggers the welcome email if not already sent.

### BR-EMP-04 — Reporting Manager Orphan Detection
- When an employee's `employment_status` is set to `resigned` or `terminated`: check if any other employees have `reporting_manager_id` pointing to this employee.
- If orphaned reports found: block the status change, notify Owner/HR with list of affected employees. Owner/HR must reassign before the change can proceed.
- Exception: if exit_date is in the future, allow the status change but queue a reminder 3 days before exit_date to reassign.

### BR-EMP-05 — Access Revocation on Exit
- When `exit_date` is set: schedule access revocation for that date at 11:59 PM IST.
- On exit_date: set `employees.is_active = false`, delete or invalidate the Supabase Auth session for that `auth_id`.
- Immediate revocation on `termination`: `is_active = false` and session revocation happen synchronously on save.

### BR-EMP-06 — Rehire Linkage
- When creating a new employee record for a rehired person: the `previous_employee_id` must point to their last active employee record.
- Leave balance on rehire: driven by `app_config.rehire_carry_leave_balance`. If `false` (default): reset to zero. If `true`: carry over remaining balance from last employment.
- Attendance history from previous employment is preserved and accessible to Owner via the old employee record.

### BR-EMP-07 — Probation End Alert
- A scheduled Edge Function runs daily and checks `employees.probation_end_date`.
- If `probation_end_date = today + 14 days`: send email notification to Owner.
- Notification content: employee name, join date, probation end date, link to profile.

### BR-EMP-08 — Department Depth Enforcement
- When creating a sub-department: check `parent_department.depth`. If `depth = 2`, block insert with error: "Maximum department nesting depth (3 levels) reached."
- New department `depth = parent.depth + 1`.
- Root departments: `depth = 0`, `parent_id = NULL`.

### BR-EMP-09 — Salary Revision Propagation
- When an `employee_lifecycle_events` row with `event_type = 'salary_revision'` is inserted: the Edge Function must also update `employees.current_salary = new_salary` for that employee.
- Only Owner can insert a salary revision lifecycle event. HR cannot update `current_salary` directly or through lifecycle events.
- `employees.current_salary` is the live current value. `employee_lifecycle_events` is the full history.
- The salary update applies immediately (same transaction as the lifecycle event insert). Future-dated salary revisions are a v2 feature.

---

## 2. Attendance Rules

---

### BR-ATT-01 — Check-In Timestamp Authority
- `check_in_time` and `check_out_time` on `attendance_records` are set exclusively by the Edge Function that handles the check-in/check-out event.
- The client sends a request to the Edge Function; the Edge Function sets the timestamp from the server clock.
- The client cannot pass a timestamp that the Edge Function uses directly.
- If `is_manually_entered = true`, the timestamp is set by Owner/HR and `manual_entry_reason` + `manual_entry_by` must be recorded.

### BR-ATT-02 — Duplicate Check-In Prevention
- A `UNIQUE` constraint on `(employee_id, date)` in `attendance_records` prevents duplicate rows.
- On check-in: upsert behaviour — if a row exists for today, update `check_in_time` (only if check_in_time IS NULL).
- If `check_in_time` is already set: return error "Already checked in today."

### BR-ATT-03 — Auto-Checkout
- A scheduled Edge Function runs at `app_config.auto_checkout_time` (default 23:59) IST every day.
- For every employee with a `check_in_time` but no `check_out_time` for today: set `check_out_time = auto_checkout_time`, set `status = 'incomplete'`.
- Next morning: when the employee logs in, show a prompt: "Your attendance for [date] was incomplete. Would you like to submit a regularization request?"
- Trigger in-app notification to employee.

### BR-ATT-04 — Status Computation
- Computed nightly by Edge Function after auto-checkout. Also computed on manual entry.
- Logic (evaluated in order; first match wins):
  1. If `status` is already `on_leave` (set when a leave application is approved for this date): do not overwrite.
  2. If date is in `holidays` table for this employee (non-optional, or employee has opted-in via `employee_optional_holidays`): status = `holiday`.
  3. If date is a weekly-off day per the employee's shift: status = `weekly_off`.
  4. If `is_wfh = true` AND `check_in_time IS NULL`: status = `work_from_home` (overrides absent).
  5. If `check_in_time` IS NULL: status = `absent`.
  6. If `check_in_time` IS NOT NULL and `check_out_time` IS NULL (after auto-checkout): status = `incomplete`.
  7. If total_hours < (shift_hours / 2): status = `half_day`.
  8. If `is_wfh = true` AND `check_in_time IS NOT NULL` AND total_hours >= (shift_hours / 2): status = `work_from_home`.
  9. If `check_in_time` IS NOT NULL and `check_out_time` IS NOT NULL and total_hours >= (shift_hours / 2): status = `present`.

### BR-ATT-05 — Total Hours Computation
- `total_hours = (check_out_time - check_in_time) in hours - (shift.break_minutes / 60)`
- If result is negative (e.g. very short session): clamp to 0.
- Night shift: if `check_out_time < check_in_time` (crossed midnight), compute as: `(check_out_time + 24 hours - check_in_time) - break`.

### BR-ATT-06 — Late Mark Rule
- `is_late = true` if `check_in_time > shift.start_time + shift.grace_period_minutes`.
- At end of each month: count `is_late = true` records for each employee.
- If count >= `shift.late_mark_threshold`: deduct 0.5 days from leave balance (Casual Leave first, then Earned Leave, then LWP). Log deduction to `leave_balances.adjusted` with reason `late_mark_deduction`.
- Late mark count resets to 0 at start of each month.

### BR-ATT-07 — Overtime Computation
- `overtime_hours = max(0, total_hours - shift_working_hours)` where `shift_working_hours = (shift.end_time - shift.start_time) in hours - (shift.break_minutes / 60)`.
- `overtime_approved` defaults to NULL (not reviewed).
- HR/Owner must explicitly approve overtime to credit it. Approval stored in `overtime_approved_by`.

### BR-ATT-08 — Regularization Window
- Employee can request regularization for records within the past N calendar days where N = `app_config.regularization_window_days` (default: 7).
- Requests beyond the window are blocked: "Regularization window is [N] days. This date is outside the allowed window."
- One pending regularization request per attendance record at a time. Enforced by partial unique index on `attendance_regularization_requests (attendance_record_id) WHERE status = 'pending'`. If a request exists, block new request until existing one is resolved.

### BR-ATT-09 — GPS Validation
- On check-in with GPS: compute distance between `(check_in_lat, check_in_lng)` and each active `geofence_config` centre.
- If distance > radius_meters for all geofences: flag with warning in UI but do not block check-in. Set `is_geo_flagged = true` on the record.
- If coordinates change by > 50 km between check-in and check-out: set `is_geo_flagged = true`. Do not auto-reject. Flag for HR review.

### BR-ATT-10 — IP Whitelist Validation
- On check-in: compare client IP against active `ip_whitelist` entries using PostgreSQL `cidr` containment.
- If IP is not in any whitelisted range: block check-in with message "Check-in is restricted to approved office networks."
- If IP whitelist is empty: whitelist check is disabled (no restrictions).

### BR-ATT-11 — Shift Resolution for an Employee on a Date
- Priority order: `employee_shift_overrides` (active on that date) → `department_shifts` (active on that date) → system default shift.
- "Active on date" means: `effective_from <= date AND (effective_to IS NULL OR effective_to >= date)`.

### BR-ATT-12 — Work From Home Logging
- Employee can mark a day as WFH by clicking "Log WFH" on the dashboard or attendance screen. This action calls an Edge Function that sets `attendance_records.is_wfh = true` for today (upsert if no row yet).
- WFH can only be logged for the current day. Past dates require a regularization request.
- WFH logging is independent of check-in/check-out. The employee may or may not also check in on a WFH day.
- Status computation (BR-ATT-04 steps 4 and 8) handles both cases: WFH without check-in → `work_from_home`; WFH with sufficient check-in hours → `work_from_home`.
- HR/Owner can set `is_wfh = true` during manual attendance entry (BR-ATT-01).
- WFH days count as present for working-day computation in leave applications (BR-LVE-01).

---

## 3. Leave Management Rules

---

### BR-LVE-01 — Working Day Computation
- Working days = count of days in `[from_date, to_date]` range that are not:
  - In `holidays` table for applicable state/type (non-optional, or employee has opted-in via `employee_optional_holidays`)
  - Weekly-off days per the employee's current shift `weekly_off_days` array
- If result = 0: block application with message "Selected dates contain no working days."
- Computation must happen server-side in Edge Function. Do not trust client-computed value.

### BR-LVE-02 — Leave Balance Validation
- On submission: compute available balance = `opening_balance + accrued + adjusted - taken - pending`.
- If `working_days_count > available_balance`:
  - If `leave_type.allow_negative_balance = false`: block with message "Insufficient balance. Available: [X] days."
  - If `leave_type.allow_negative_balance = true`: show confirmation dialog "This will result in Leave Without Pay for [Y] days. Proceed?"
- Pending balance (`leave_balances.pending`) is incremented immediately on submission, before approval.

### BR-LVE-03 — Overlap Prevention
- Before creating a `leave_applications` row: check if any `approved` or `pending` application for this employee has a date range that overlaps with the new application's `[from_date, to_date]`.
- Overlap condition: `new.from_date <= existing.to_date AND new.to_date >= existing.from_date`.
- If overlap exists: block with message "You already have a [status] leave for this period. Please cancel it first."

### BR-LVE-04 — Leave on Attendance Record
- When a leave application is approved: for each working day in the approved range, upsert `attendance_records` setting `status = 'on_leave'`.
- If an attendance record already exists for that date with `status = 'present'` or `'work_from_home'`: do not overwrite. Log a conflict flag for HR review.
- When a leave is cancelled after approval: revert `attendance_records.status` from `on_leave` back to `absent` for future dates only. Past dates are not reverted.

### BR-LVE-05 — Leave Balance Update on Approval
- On approval: `leave_balances.taken += working_days_count`, `leave_balances.pending -= working_days_count`.
- On rejection: `leave_balances.pending -= working_days_count` (reverse hold). `taken` unchanged.
- On cancellation of approved leave: `leave_balances.taken -= working_days_count`. Only for future dates — past dates are not reversed.

### BR-LVE-06 — Leave Approval SLA Escalation
- A scheduled Edge Function checks pending leave applications every hour.
- If a `leave_applications` row has `status = 'pending'` and `applied_at < now() - app_config.leave_sla_business_days business days`:
  - Set `escalated_to = Owner.id`
  - Set `escalated_at = now()`
  - Send email + in-app notification to Owner: "Leave request from [employee] has been pending for [N] business days."
- Business days exclude holidays and weekly-offs (use the company's holiday calendar).

### BR-LVE-07 — HR on Leave Routing
- When a leave application is submitted: check if the employee's `reporting_manager_id` has an active approved leave for the same date range.
- If reporting manager is on leave: set `escalated_to = Owner.id` and `escalated_at = now()` at submission time so the notification and approval queue route to Owner.
- `reviewed_by` is NOT pre-assigned at submission. It is set only when an actual review action (approve/reject) occurs.

### BR-LVE-08 — Half-Day Leave Logic
- If `is_half_day = true`: `working_days_count = 0.5`.
- `half_day_period` must be `morning` or `afternoon`.
- The attendance record for that date: `status = 'half_day'`. Check-in and check-out times still tracked.
- Leave balance deducted: 0.5 days.

### BR-LVE-09 — Leave Cancellation Flow
- **Pending application:** Employee can cancel immediately. No approval needed. `status = 'cancelled'`. Pending hold reversed from `leave_balances`.
- **Approved future application:** Employee submits cancellation request. The Edge Function sets `cancellation_requested = true` and `cancellation_requested_at = now()` on the `leave_applications` row. `status` does not change to `cancelled` yet. HR/Owner sees these in a "Pending Cancellation" queue. HR/Owner confirms → `cancellation_requested` reset to `false`, `status = 'cancelled'`, balance restored. HR/Owner rejects cancellation → `cancellation_requested` reset to `false`, status remains `approved`.
- **Approved past application:** Cannot be cancelled. Employee must submit a retroactive correction request (HR discretion, not a system flow).

### BR-LVE-10 — Year-End Leave Processing
- A scheduled Edge Function runs on January 1st each year.
- For each employee × leave type:
  1. Compute carry-forward: `min(current_balance, leave_type.max_carry_forward_days)`.
  2. Set `opening_balance = carry_forward` and `carry_forward_amount = carry_forward` for the new year row.
  3. Set `carry_forward_expiry = January 1 + leave_type.carry_forward_expiry_days` if configured.
  4. Set `accrued = 0`, `taken = 0`, `pending = 0`, `adjusted = 0` for the new year row.
- If `leave_type.accrual_type = 'yearly'`: credit full `accrual_days` at year start (add to `accrued`).
- If `leave_type.accrual_type = 'monthly'`: credit `accrual_days / 12` on the 1st of each month via a separate monthly scheduled Edge Function.

### BR-LVE-11 — Carry-Forward Expiry Alert
- A scheduled Edge Function runs daily.
- For each `leave_balances` row where `carry_forward_expiry IS NOT NULL`:
  - If `carry_forward_expiry = today + 30 days`: send email to employee.
  - If `carry_forward_expiry = today + 7 days`: send email to employee.
  - If `carry_forward_expiry = today`: lapse the carry-forward portion. Reduce `opening_balance` by `leave_balances.carry_forward_amount` for that row. Set `carry_forward_amount = 0`. Log to `audit_logs`.

### BR-LVE-12 — Comp-Off Expiry
- Default expiry: `worked_date + app_config.comp_off_expiry_days` (default: 60 days). Configurable per company via `app_config`.
- A scheduled Edge Function runs daily: for `comp_off_requests` where `status = 'approved'` and `comp_off_expiry_date = today`: reduce the corresponding `leave_balances` entry. Log to `audit_logs`.
- Employee is notified 7 days before comp-off expiry.

### BR-LVE-13 — Attachment Enforcement
- On leave application submit: if `leave_type.requires_attachment = true` OR `working_days_count > leave_type.attachment_required_after_days`: validate that `attachment_path IS NOT NULL`.
- If validation fails: block submission with message "Attachment is required for this leave type/duration."
- Attachment must be uploaded to Supabase Storage before form submission. The Edge Function verifies the `attachment_path` points to a valid file in the `leave-attachments` bucket.

### BR-LVE-14 — Retroactive Holiday Addition
- When a holiday is added for a past date:
  - If any employee has `attendance_records.status = 'absent'` for that date: auto-convert to `holiday`. No leave balance impact.
  - If any employee has `status = 'present'` or `'work_from_home'`: do not change. Log a notification to HR: "[N] employees were marked present on the newly added holiday [date]. Review if needed."
  - If any employee has an approved leave for that date: HR is notified. The leave day count is not automatically revised (HR must manually adjust if applicable).

### BR-LVE-15 — Max Consecutive Days Enforcement
- On leave application submit: if `leave_type.max_consecutive_days IS NOT NULL`, validate that `working_days_count <= leave_type.max_consecutive_days`.
- If exceeded: block with message "This leave type allows a maximum of [N] consecutive working days per application."
- Enforced server-side in Edge Function before insert.

### BR-LVE-16 — Minimum Notice Days Enforcement
- On leave application submit: if `leave_type.min_notice_days > 0`, validate that `from_date >= today + min_notice_days`.
- If violated: block with message "This leave type requires [N] days advance notice. Earliest allowed start date is [date]."
- Owner and HR are exempt from the minimum notice check when entering leave on behalf of an employee.
- Enforced server-side in Edge Function.

### BR-LVE-17 — Applicable Gender Enforcement
- On leave application submit: if `leave_type.applicable_gender IS NOT NULL`, validate that `employees.gender = leave_type.applicable_gender`.
- If mismatch: block with message "This leave type is not applicable to your gender."
- Leave types with `applicable_gender = NULL` are available to all employees regardless of gender.
- Enforced server-side in Edge Function.

### BR-LVE-18 — Optional Holiday Opt-In
- Employee can opt into optional holidays (where `holidays.is_optional = true`) via the holiday calendar screen (S-20).
- Maximum opt-ins per year per employee = `app_config.optional_holiday_limit_per_year` (default: 2). Edge Function blocks insert if limit is reached.
- On opt-in: INSERT into `employee_optional_holidays`. On opt-out: DELETE the row.
- Opt-in is allowed only for future dates. Employees cannot opt into an optional holiday that has already passed.
- Opted-in optional holidays are treated as non-working days in working-day computation (BR-LVE-01) and in status computation (BR-ATT-04 step 2).
- Opting out of an optional holiday that already has an approved leave for that date is blocked: "You have approved leave for this holiday. Cancel the leave before opting out."

---

## 4. Notification Rules

---

### BR-NOT-01 — Notification Triggers and Recipients

| Trigger | Recipients | Channels |
|---|---|---|
| New employee created | Employee (welcome + credentials), Owner (confirmation) | Email |
| Leave application submitted | HR (or Owner if HR is on leave) | Email + In-app |
| Leave approved | Employee | Email + In-app |
| Leave rejected | Employee | Email + In-app |
| Leave cancellation confirmed | Employee | Email + In-app |
| Leave cancellation rejected | Employee | Email + In-app |
| Regularization request submitted | HR/Owner | Email + In-app |
| Regularization approved | Employee | Email + In-app |
| Regularization rejected | Employee | Email + In-app |
| Incomplete attendance (forgot checkout) | Employee (next morning) | Email + In-app |
| Probation end approaching (14 days) | Owner | Email |
| Leave balance expiry (30 and 7 days) | Employee | Email |
| Leave SLA breach (N business days) | Owner | Email |
| Employee exit approaching (7 days) | Owner, HR, System Admin | Email |
| Comp-off expiry (7 days) | Employee | Email |
| Future joiner activation | Owner, HR | In-app |

### BR-NOT-02 — In-App Notification Delivery
- Written to `notifications` table by Edge Functions.
- Supabase Realtime subscription in frontend on `notifications` table where `recipient_id = current_user_id AND is_read = false`.
- On new row: update unread count badge on notification bell without page refresh.
- Mark as read: update `is_read = true`, `read_at = now()` when user opens notification or clicks "Mark all read."

### BR-NOT-03 — Email Delivery
- Sent via Resend or SendGrid from Edge Functions.
- Never sent directly from the client.
- Template content: defined in Edge Function. Must include: company name, action description, deep link to relevant record, "do not reply" footer.

---

## 5. Audit Rules

---

### BR-AUD-01 — What Must Be Logged
Every INSERT, UPDATE, DELETE on the following tables must write to `audit_logs`:
`employees`, `departments`, `designations`, `employee_documents`, `employee_bank_details`, `employee_lifecycle_events`, `attendance_records`, `attendance_regularization_requests`, `leave_types`, `leave_balances`, `leave_applications`, `comp_off_requests`, `shifts`, `department_shifts`, `employee_shift_overrides`, `holidays`, `onboarding_checklist_templates`, `ip_whitelist`, `geofence_config`, `app_config`, `employee_optional_holidays`

### BR-AUD-02 — PII Exclusion from Logs
- `account_number_encrypted` must never appear in `audit_logs.old_data` or `audit_logs.new_data`. Replace with `{"account_number_encrypted": "[MASKED]"}`.
- `date_of_birth` is allowed in audit logs (not considered sensitive enough to mask, but monitor per DPDP compliance review).

### BR-AUD-03 — Audit Actor Attribution
- `actor_id` is the `employees.id` of the logged-in user performing the action.
- `actor_role` is a snapshot of `employees.role` at the time of the action (stored so historical role is preserved even if role changes later).
- If the action is triggered by a scheduled Edge Function (no user context): `actor_id = NULL`, `actor_role = NULL`. Set `actor_system_function` to a descriptive label (e.g. `auto_checkout`, `year_end_rollover`). `actor_id` and `actor_system_function` are mutually exclusive — only one is non-null per row.

### BR-AUD-04 — Retention
- Audit logs are retained for 3 years from `created_at`.
- After 3 years: archive to cold storage (Supabase Storage or external). Never hard-delete from `audit_logs` table within the window.
- System Admin can initiate archive via a manual Edge Function invocation. Not a UI feature in v1.

---

## 6. Data Integrity Rules

---

### BR-INT-01 — Soft Delete Policy
- No user data is hard-deleted in v1. All deletions are soft: set `is_active = false`.
- Application must filter `WHERE is_active = true` on all standard queries.
- Inactive records are only visible to Owner and System Admin via explicit filter.

### BR-INT-02 — Immutable Records
- `employee_lifecycle_events`: no UPDATE or DELETE ever. INSERT only.
- `audit_logs`: no UPDATE or DELETE within retention window.
- `leave_applications`: status can change but `employee_id`, `leave_type_id`, `from_date`, `to_date`, `working_days_count`, `applied_at` are immutable after INSERT.

### BR-INT-03 — Leave Balance Integrity
- `leave_balances.taken + leave_balances.pending` must never exceed `opening_balance + accrued + adjusted` unless `leave_type.allow_negative_balance = true`.
- This check runs in the Edge Function before any leave approval or balance deduction.

### BR-INT-04 — Employee Code Uniqueness
- `employee_code` is globally unique (not just per year). Enforced by UNIQUE constraint.
- On year rollover: the sequential counter resets but the globally unique constraint prevents collision.

---

## 7. Scheduled Edge Functions Summary

| Function Name | Trigger | Action |
|---|---|---|
| `auto-checkout` | Daily at app_config.auto_checkout_time IST | Mark incomplete attendance, trigger notification |
| `compute-attendance-status` | Daily at 00:05 IST (after auto-checkout) | Update status for all of yesterday's records |
| `late-mark-deduction` | 1st of each month, 00:10 IST | Count late marks, deduct from leave balance |
| `monthly-leave-accrual` | 1st of each month, 00:15 IST | Credit monthly accrued leave for applicable leave types |
| `year-end-leave-rollover` | Jan 1st, 00:30 IST | Process carry-forward, set carry_forward_amount, create new year leave balance rows |
| `carry-forward-expiry-alert` | Daily at 09:00 IST | Send 30-day and 7-day expiry warnings |
| `carry-forward-lapse` | Daily at 00:20 IST | Lapse expired carry-forward balances using carry_forward_amount |
| `comp-off-expiry-alert` | Daily at 09:05 IST | Send 7-day comp-off expiry warnings |
| `comp-off-lapse` | Daily at 00:25 IST | Lapse expired comp-off balances |
| `leave-sla-escalation` | Every hour | Escalate pending leave requests past app_config.leave_sla_business_days |
| `probation-end-alert` | Daily at 09:10 IST | Alert Owner 14 days before probation end |
| `exit-date-alert` | Daily at 09:15 IST | Alert Owner/HR/SysAdmin 7 days before exit |
| `access-revocation` | Daily at 23:55 IST | Revoke access for employees whose exit_date = today |
| `future-joiner-activation` | Daily at 00:01 IST | Activate employees whose join_date = today |
| `incomplete-attendance-reminder` | Daily at 09:00 IST | Notify employees with incomplete attendance yesterday |

---

## 8. Validation Rules Summary

| Field / Action | Rule | Where Enforced |
|---|---|---|
| Email format | Valid email regex | Edge Function + DB check constraint |
| Employee code | EMP-YYYY-NNNN format | Edge Function on INSERT |
| Document file size | ≤ 5 MB | Client-side (soft) + Edge Function (hard) |
| Document MIME type | PDF, JPEG, PNG only | Edge Function |
| Document type value | Must be one of: aadhar, pan, offer_letter, appointment_letter, experience_letter, other | DB check constraint + Edge Function |
| Leave date range | to_date >= from_date | DB check constraint |
| Leave working days | > 0 | DB check constraint + Edge Function computation |
| Half-day period | morning or afternoon only | DB check constraint |
| Leave min notice days | from_date >= today + min_notice_days (Owner/HR exempt) | Edge Function on submit |
| Leave max consecutive days | working_days_count <= max_consecutive_days | Edge Function on submit |
| Leave applicable gender | employees.gender must match leave_type.applicable_gender | Edge Function on submit |
| Comp-off expiry | worked_date + app_config.comp_off_expiry_days | Edge Function on approval |
| Department depth | max depth = 2 | Edge Function on INSERT |
| Account number | Encrypted before insert | Edge Function |
| check_in/out times | Server-set only | Edge Function (never client-settable) |
| Regularization window | Within last app_config.regularization_window_days days | Edge Function |
| Regularization one-pending-per-record | Block if pending request already exists | DB partial unique index + Edge Function |
| Duplicate PAN/Aadhar | Block + override flow | Edge Function + DB partial unique on document_hash |
| Overlap leave | No overlapping pending/approved | Edge Function pre-check |
| Optional holiday limit | Max app_config.optional_holiday_limit_per_year per employee per year | Edge Function on opt-in |
| cancellation_requested | Set only by Edge Function on cancellation request; never direct client update | Edge Function |
| Salary revision propagation | employees.current_salary updated on salary_revision lifecycle event insert | Edge Function (BR-EMP-09) |
