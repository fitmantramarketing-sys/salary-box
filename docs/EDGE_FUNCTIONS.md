# EDGE_FUNCTIONS.md
## Internal HR Tool — Edge Function Contracts
**Source of truth:** HR_Tool_PRD_v1 (June 2026)
**Status:** Implementation-ready specification. No code.

---

## Overview

All Edge Functions are Deno/TypeScript deployed on Supabase. This document defines the contract for every function: path, auth requirements, request body, success response, and error cases.

---

## Global Conventions

### Authentication
Every client-callable function verifies the user JWT from the `Authorization` header:
```
Authorization: Bearer <supabase_user_jwt>
```
The function resolves `actor_id` (the `employees.id` matching `auth.uid()`) and `actor_role` from the `employees` table before executing any logic.

Cron functions are invoked by Supabase's pg_cron with the service role key. They do not accept an `Authorization` header.

### Standard Response Shape

**Success:**
```json
{ "data": <payload> }
```

**Error:**
```json
{
  "error": {
    "code": "<ERROR_CODE>",
    "message": "<human-readable message>",
    "details": <optional additional context>
  }
}
```

### Error Codes

| Code | HTTP Status | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | No valid session or JWT expired |
| `FORBIDDEN` | 403 | Valid session but insufficient role for this action |
| `NOT_FOUND` | 404 | Referenced record does not exist |
| `VALIDATION_ERROR` | 400 | Request body failed schema or business rule validation |
| `CONFLICT` | 409 | State conflict (e.g. already checked in, overlapping leave) |
| `DUPLICATE` | 409 | Uniqueness violation (e.g. duplicate PAN) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Shared Utilities (`supabase/functions/_shared/`)

| File | Purpose |
|---|---|
| `supabase.ts` | Returns a service-role Supabase client. Used for all DB operations inside Edge Functions. |
| `auth.ts` | `getActor(req)` — verifies JWT, returns `{ actorId, actorRole, authUid }` or throws `UNAUTHORIZED`. |
| `response.ts` | `ok(data)` and `err(code, message, status?, details?)` — build standard Response objects. |
| `email.ts` | `sendEmail({ to, subject, html })` — Resend wrapper. Never call Resend directly in a function. |
| `notify.ts` | `createNotification({ recipientId, title, body, type, referenceId, referenceTable })` — inserts into `notifications` table. |
| `audit.ts` | `logAudit({ tableName, recordId, action, actorId?, actorRole?, actorSystemFunction?, oldData?, newData?, ipAddress? })` — used by cron functions that cannot rely on the DB trigger actor context. |
| `working-days.ts` | `countWorkingDays(employeeId, fromDate, toDate)` — server-side working day computation per BR-LVE-01. |
| `shift.ts` | `resolveShift(employeeId, date)` — returns the applicable shift per BR-ATT-11. |

---

## Client-Callable Functions

---

### `check-in`
**Path:** `POST /functions/v1/check-in`
**Auth:** User JWT required. Role: `owner`, `hr`, `employee`.

**Request body:**
```json
{
  "latitude": 18.5204,       // optional, numeric(10,7)
  "longitude": 73.8567       // optional, numeric(10,7)
}
```

**Logic:**
1. Resolve actor from JWT.
2. Check IP whitelist (BR-ATT-10): if whitelist is non-empty and client IP not in any range → `FORBIDDEN`.
3. Check GPS geofence (BR-ATT-09): if coordinates provided and outside all geofences → set `is_geo_flagged = true` (do not block).
4. Resolve today's shift for this employee (BR-ATT-11).
5. Upsert `attendance_records` for `(employee_id, today)`. Set `check_in_time = now()` server-side only if `check_in_time IS NULL`.
6. If `check_in_time` already set → return `CONFLICT`.
7. Set `is_late` based on BR-ATT-06.

**Success response (200):**
```json
{
  "data": {
    "attendance_record_id": "uuid",
    "check_in_time": "2026-06-09T09:05:00+05:30",
    "is_late": false,
    "is_geo_flagged": false
  }
}
```

**Error cases:**
- `CONFLICT` — already checked in today
- `FORBIDDEN` — IP not in whitelist

---

### `check-out`
**Path:** `POST /functions/v1/check-out`
**Auth:** User JWT required. Role: `owner`, `hr`, `employee`.

**Request body:**
```json
{
  "latitude": 18.5204,       // optional
  "longitude": 73.8567       // optional
}
```

**Logic:**
1. Resolve actor from JWT.
2. Find today's `attendance_records` row for this employee. If none → `NOT_FOUND`.
3. If `check_out_time` already set → `CONFLICT`.
4. Set `check_out_time = now()` server-side.
5. Compute `total_hours` (BR-ATT-05) and `overtime_hours` (BR-ATT-07).
6. Update `check_out_lat`, `check_out_lng`.
7. GPS drift check: if distance between check-in and check-out coordinates > 50 km → set `is_geo_flagged = true`.

**Success response (200):**
```json
{
  "data": {
    "attendance_record_id": "uuid",
    "check_out_time": "2026-06-09T18:32:00+05:30",
    "total_hours": 8.45,
    "overtime_hours": 0.45,
    "is_geo_flagged": false
  }
}
```

**Error cases:**
- `NOT_FOUND` — no check-in record for today
- `CONFLICT` — already checked out

---

### `log-wfh`
**Path:** `POST /functions/v1/log-wfh`
**Auth:** User JWT required. Role: `owner`, `hr`, `employee`.

**Request body:** `{}` (empty — logs WFH for today for the authenticated employee)

**Logic:**
1. Resolve actor.
2. Upsert `attendance_records` for `(employee_id, today)`, set `is_wfh = true`.
3. Do not overwrite `check_in_time` or any other field.
4. If status is already `on_leave` → `CONFLICT` ("Cannot log WFH on an approved leave day").

**Success response (200):**
```json
{
  "data": {
    "attendance_record_id": "uuid",
    "is_wfh": true
  }
}
```

**Error cases:**
- `CONFLICT` — day is already marked as on_leave

---

### `submit-leave`
**Path:** `POST /functions/v1/submit-leave`
**Auth:** User JWT required. Role: `owner`, `hr`, `employee`.

**Request body:**
```json
{
  "leave_type_id": "uuid",
  "from_date": "2026-06-15",
  "to_date": "2026-06-17",
  "is_half_day": false,
  "half_day_period": null,        // "morning" | "afternoon" | null
  "reason": "Family function",
  "attachment_path": null          // Supabase Storage path, required for some leave types
}
```

**Logic:**
1. Resolve actor.
2. Validate `leave_type` is active. Validate `applicable_gender` (BR-LVE-17).
3. Validate `min_notice_days` (BR-LVE-16). Exempt if actor is `owner` or `hr`.
4. Compute `working_days_count` server-side (BR-LVE-01).
5. Validate `working_days_count > 0`.
6. Validate `max_consecutive_days` (BR-LVE-15).
7. Validate attachment if required (BR-LVE-13).
8. Check overlap (BR-LVE-03).
9. Validate leave balance (BR-LVE-02). Increment `leave_balances.pending`.
10. Insert `leave_applications` row with `status = 'pending'`.
11. Check if reporting manager is on leave (BR-LVE-07). If yes, set `escalated_to = owner.id`.
12. Create notification for approver.

**Success response (201):**
```json
{
  "data": {
    "application_id": "uuid",
    "working_days_count": 3,
    "status": "pending",
    "escalated_to": null
  }
}
```

**Error cases:**
- `VALIDATION_ERROR` — balance insufficient, no working days, attachment missing, gender mismatch, notice period violated, max consecutive days exceeded
- `CONFLICT` — overlapping leave exists

---

### `review-leave`
**Path:** `POST /functions/v1/review-leave`
**Auth:** User JWT required. Role: `owner`, `hr`.

**Request body:**
```json
{
  "application_id": "uuid",
  "action": "approve",            // "approve" | "reject"
  "comment": "Approved."          // optional
}
```

**Logic:**
1. Resolve actor. Verify role is `owner` or `hr`.
2. Fetch application. Verify `status = 'pending'`.
3. Set `reviewed_by = actor_id`, `reviewed_at = now()`, `reviewer_comment`.
4. If `approve`:
   - Set `status = 'approved'`.
   - Update `leave_balances`: `taken += working_days_count`, `pending -= working_days_count` (BR-LVE-05).
   - Upsert `attendance_records` for each working day in range with `status = 'on_leave'` (BR-LVE-04).
5. If `reject`:
   - Set `status = 'rejected'`.
   - Update `leave_balances`: `pending -= working_days_count` (BR-LVE-05).
6. Send notification to employee.

**Success response (200):**
```json
{
  "data": {
    "application_id": "uuid",
    "status": "approved"
  }
}
```

**Error cases:**
- `FORBIDDEN` — actor is not owner or hr
- `NOT_FOUND` — application not found
- `CONFLICT` — application is not in pending status

---

### `cancel-leave`
**Path:** `POST /functions/v1/cancel-leave`
**Auth:** User JWT required. Role: `owner`, `hr`, `employee`.

**Request body:**
```json
{
  "application_id": "uuid",
  "reason": "Plans changed"
}
```

**Logic:**
1. Resolve actor.
2. Fetch application. Verify it belongs to actor (or actor is owner/hr).
3. Verify `status = 'pending'`. If approved → return `CONFLICT` (must use `request-leave-cancellation` instead).
4. Set `status = 'cancelled'`, `cancelled_by = actor_id`, `cancelled_at = now()`, `cancellation_reason`.
5. Reverse `leave_balances.pending -= working_days_count`.

**Success response (200):**
```json
{ "data": { "application_id": "uuid", "status": "cancelled" } }
```

**Error cases:**
- `FORBIDDEN` — application belongs to another employee and actor is not owner/hr
- `NOT_FOUND` — application not found
- `CONFLICT` — status is not pending (use request-leave-cancellation for approved)

---

### `request-leave-cancellation`
**Path:** `POST /functions/v1/request-leave-cancellation`
**Auth:** User JWT required. Role: `owner`, `hr`, `employee`.

**Request body:**
```json
{
  "application_id": "uuid",
  "reason": "Medical recovery complete"
}
```

**Logic:**
1. Resolve actor.
2. Fetch application. Verify it belongs to actor (or owner/hr).
3. Verify `status = 'approved'` and `from_date > today` (future leave only).
4. Set `cancellation_requested = true`, `cancellation_requested_at = now()`, `cancellation_reason`.
5. Do NOT change `status`.
6. Notify HR/Owner.

**Success response (200):**
```json
{ "data": { "application_id": "uuid", "cancellation_requested": true } }
```

**Error cases:**
- `CONFLICT` — status is not approved, or from_date is in the past

---

### `confirm-leave-cancellation`
**Path:** `POST /functions/v1/confirm-leave-cancellation`
**Auth:** User JWT required. Role: `owner`, `hr`.

**Request body:**
```json
{
  "application_id": "uuid",
  "action": "confirm",            // "confirm" | "reject"
  "comment": null
}
```

**Logic:**
1. Verify actor is owner or hr.
2. Fetch application. Verify `cancellation_requested = true`.
3. If `confirm`:
   - Set `status = 'cancelled'`, `cancelled_by = actor_id`, `cancelled_at = now()`.
   - Set `cancellation_requested = false`.
   - Reverse `leave_balances.taken` for future dates only (BR-LVE-05).
   - Revert `attendance_records.status` from `on_leave` to `absent` for future dates only (BR-LVE-04).
4. If `reject`:
   - Set `cancellation_requested = false`.
   - Status remains `approved`.
5. Notify employee.

**Success response (200):**
```json
{ "data": { "application_id": "uuid", "status": "approved" | "cancelled" } }
```

---

### `submit-regularization`
**Path:** `POST /functions/v1/submit-regularization`
**Auth:** User JWT required. Role: `owner`, `hr`, `employee`.

**Request body:**
```json
{
  "attendance_record_id": "uuid",
  "requested_status": "present",
  "requested_check_in": "2026-06-08T09:00:00+05:30",   // optional
  "requested_check_out": "2026-06-08T18:00:00+05:30",  // optional
  "reason": "Forgot to check in"
}
```

**Logic:**
1. Resolve actor.
2. Fetch `attendance_records` row. Verify it belongs to actor (or owner/hr on behalf of).
3. Validate date is within `app_config.regularization_window_days` (BR-ATT-08).
4. Check no pending regularization exists for this record (partial unique index enforces, but return a clean error).
5. Insert `attendance_regularization_requests` row.
6. Notify HR/Owner.

**Success response (201):**
```json
{ "data": { "request_id": "uuid", "status": "pending" } }
```

**Error cases:**
- `VALIDATION_ERROR` — date outside regularization window
- `CONFLICT` — pending request already exists for this record

---

### `review-regularization`
**Path:** `POST /functions/v1/review-regularization`
**Auth:** User JWT required. Role: `owner`, `hr`.

**Request body:**
```json
{
  "request_id": "uuid",
  "action": "approve",            // "approve" | "reject"
  "comment": null
}
```

**Logic:**
1. Verify actor is owner or hr.
2. Fetch request. Verify `status = 'pending'`.
3. Set `status`, `reviewed_by`, `reviewed_at`, `reviewer_comment`.
4. If `approve`:
   - Update the linked `attendance_records` row with `requested_status`, `requested_check_in`, `requested_check_out`.
   - Recompute `total_hours`, `overtime_hours`, `is_late` (BR-ATT-05, BR-ATT-06, BR-ATT-07).
5. Notify employee.

**Success response (200):**
```json
{ "data": { "request_id": "uuid", "status": "approved" } }
```

---

### `submit-comp-off`
**Path:** `POST /functions/v1/submit-comp-off`
**Auth:** User JWT required. Role: `owner`, `hr`, `employee`.

**Request body:**
```json
{
  "worked_date": "2026-05-01",
  "hours_worked": 8.0,
  "reason": "Worked on Labour Day"
}
```

**Logic:**
1. Resolve actor.
2. Validate `worked_date` is a holiday or weekly-off per the employee's shift.
3. Insert `comp_off_requests` row with `status = 'pending'`.
4. Notify HR/Owner.

**Success response (201):**
```json
{ "data": { "request_id": "uuid" } }
```

**Error cases:**
- `VALIDATION_ERROR` — worked_date is not a holiday or weekly-off

---

### `review-comp-off`
**Path:** `POST /functions/v1/review-comp-off`
**Auth:** User JWT required. Role: `owner`, `hr`.

**Request body:**
```json
{
  "request_id": "uuid",
  "action": "approve",
  "comment": null
}
```

**Logic:**
1. Verify actor is owner or hr.
2. Fetch request. Verify `status = 'pending'`.
3. Set `status`, `reviewed_by`, `reviewed_at`.
4. If `approve`:
   - Compute `comp_off_expiry_date = worked_date + app_config.comp_off_expiry_days`.
   - Find or create `leave_balances` row for the comp-off leave type for current year.
   - Increment `leave_balances.accrued += 1`.
   - Set `leave_balance_id` on the comp-off request.
5. Notify employee.

**Success response (200):**
```json
{ "data": { "request_id": "uuid", "status": "approved", "comp_off_expiry_date": "2026-06-30" } }
```

---

### `opt-in-holiday`
**Path:** `POST /functions/v1/opt-in-holiday`
**Auth:** User JWT required. Role: `owner`, `hr`, `employee`.

**Request body:**
```json
{ "holiday_id": "uuid" }
```

**Logic:**
1. Resolve actor.
2. Fetch holiday. Verify `is_optional = true`. Verify date is in the future.
3. Count existing opt-ins for `(employee_id, year)`. If >= `app_config.optional_holiday_limit_per_year` → `FORBIDDEN`.
4. Insert `employee_optional_holidays` row.

**Success response (201):**
```json
{ "data": { "holiday_id": "uuid", "opted_in": true } }
```

**Error cases:**
- `FORBIDDEN` — annual opt-in limit reached
- `VALIDATION_ERROR` — holiday is not optional, or date is in the past

---

### `opt-out-holiday`
**Path:** `POST /functions/v1/opt-out-holiday`
**Auth:** User JWT required. Role: `owner`, `hr`, `employee`.

**Request body:**
```json
{ "holiday_id": "uuid" }
```

**Logic:**
1. Resolve actor.
2. Verify date is in the future.
3. Check no approved leave exists for this employee on this holiday date (BR-LVE-18). If yes → `CONFLICT`.
4. Delete `employee_optional_holidays` row for `(employee_id, holiday_id)`.

**Success response (200):**
```json
{ "data": { "holiday_id": "uuid", "opted_in": false } }
```

**Error cases:**
- `CONFLICT` — approved leave exists for this date; cancel the leave first
- `VALIDATION_ERROR` — date is in the past

---

### `create-employee`
**Path:** `POST /functions/v1/create-employee`
**Auth:** User JWT required. Role: `owner` only.

**Request body:**
```json
{
  "first_name": "Priya",
  "last_name": "Sharma",
  "email": "priya@company.com",
  "phone": "9876543210",
  "date_of_birth": "1995-04-12",
  "gender": "female",
  "personal_email": "priya@gmail.com",
  "address_line1": "42 Park Street",
  "address_line2": null,
  "city": "Mumbai",
  "state": "MH",
  "pincode": "400001",
  "emergency_contact_name": "Rajesh Sharma",
  "emergency_contact_phone": "9876543211",
  "department_id": "uuid",
  "designation_id": "uuid",
  "reporting_manager_id": "uuid",
  "role": "employee",
  "employment_type": "full_time",
  "join_date": "2026-07-01",
  "probation_end_date": "2026-10-01",
  "current_salary": 600000.00,
  "previous_employee_id": null
}
```

**Logic:**
1. Verify actor is `owner`.
2. Validate email uniqueness.
3. Auto-generate `employee_code` in format `EMP-YYYY-NNNN` (BR-EMP-01).
4. Set `employment_status`: if `join_date > today` → `future_joiner`, else `active`.
5. Insert `employees` row.
6. Create Supabase Auth account for the email. Set `is_first_login = true`.
7. Send welcome email with temp password.
8. Create `employee_onboarding_progress` rows from all active `onboarding_checklist_templates`.
9. Create `leave_balances` rows for current year for all active leave types.

**Success response (201):**
```json
{
  "data": {
    "employee_id": "uuid",
    "employee_code": "EMP-2026-0005",
    "employment_status": "active"
  }
}
```

**Error cases:**
- `FORBIDDEN` — actor is not owner
- `DUPLICATE` — email already exists

---

### `upload-document`
**Path:** `POST /functions/v1/upload-document`
**Auth:** User JWT required. Role: `owner`, `hr`, `employee` (own only).

**Request body:** `multipart/form-data`
```
employee_id: uuid
document_type: "aadhar" | "pan" | "offer_letter" | "appointment_letter" | "experience_letter" | "other"
file: <binary>
```

**Logic:**
1. Resolve actor. If `employee` role: verify `employee_id = actor's own id`.
2. Validate MIME type: PDF, JPEG, PNG only. Validate size ≤ 5 MB.
3. Compute SHA-256 `document_hash` of the file bytes.
4. For `pan` or `aadhar`: check if `document_hash` exists in `employee_documents` for another active employee. If found → return `DUPLICATE` with the conflicting employee code. Owner can override by passing `force: true` in the request.
5. Upload file to `employee-documents/{employee_id}/{uuid}.{ext}` bucket.
6. Insert `employee_documents` row.

**Request body (with Owner override):**
```json
{
  "employee_id": "uuid",
  "document_type": "pan",
  "force": true,
  "override_reason": "Shared PAN — verified with accounts"
}
```

**Success response (201):**
```json
{ "data": { "document_id": "uuid", "storage_path": "employee-documents/..." } }
```

**Error cases:**
- `VALIDATION_ERROR` — wrong MIME type or file too large
- `DUPLICATE` — PAN/Aadhar already exists for another employee (can be overridden by Owner)

---

### `manual-attendance`
**Path:** `POST /functions/v1/manual-attendance`
**Auth:** User JWT required. Role: `owner`, `hr`.

**Request body:**
```json
{
  "employee_id": "uuid",
  "date": "2026-06-05",
  "check_in_time": "2026-06-05T09:00:00+05:30",
  "check_out_time": "2026-06-05T18:00:00+05:30",
  "is_wfh": false,
  "reason": "Employee was present but forgot to check in"
}
```

**Logic:**
1. Verify actor is owner or hr.
2. Upsert `attendance_records` for `(employee_id, date)`.
3. Set `is_manually_entered = true`, `manual_entry_reason`, `manual_entry_by = actor_id`.
4. Compute `total_hours`, `overtime_hours`, `is_late` server-side.
5. Recompute `status` per BR-ATT-04.

**Success response (200):**
```json
{ "data": { "attendance_record_id": "uuid", "status": "present", "total_hours": 8.5 } }
```

---

### `add-lifecycle-event`
**Path:** `POST /functions/v1/add-lifecycle-event`
**Auth:** User JWT required. Role: `owner` (all event types), `hr` (promotion, transfer only).

**Request body:**
```json
{
  "employee_id": "uuid",
  "event_type": "promotion",
  "effective_date": "2026-07-01",
  "previous_designation_id": "uuid",
  "new_designation_id": "uuid",
  "previous_department_id": null,
  "new_department_id": null,
  "previous_salary": null,
  "new_salary": null,
  "reason": "Annual performance review",
  "document_path": null
}
```

**Allowed `event_type` by role:**
- `owner`: `promotion`, `transfer`, `salary_revision`, `resignation`, `termination`, `rehire`
- `hr`: `promotion`, `transfer`, `resignation`

**Logic:**
1. Verify actor role against allowed event_type list. `termination` and `salary_revision` are owner-only (BR-EMP-09, ROLE_RULES).
2. If `termination`:
   - Verify no orphaned `reporting_manager_id` references (BR-EMP-04). If found → `CONFLICT` with list of affected employees.
   - Set `employees.employment_status = 'terminated'`, `exit_date = effective_date`.
   - If `effective_date = today`: immediately revoke — set `is_active = false`, invalidate Supabase Auth session.
3. If `salary_revision`:
   - Update `employees.current_salary = new_salary` (BR-EMP-09).
4. If `transfer`:
   - Update `employees.department_id = new_department_id`.
5. If `promotion`:
   - Update `employees.designation_id = new_designation_id`.
6. Insert `employee_lifecycle_events` row (immutable).

**Success response (201):**
```json
{ "data": { "event_id": "uuid" } }
```

**Error cases:**
- `FORBIDDEN` — actor role not allowed for this event_type
- `CONFLICT` — termination blocked by orphaned reporting lines

---

### `generate-presigned-url`
**Path:** `POST /functions/v1/generate-presigned-url`
**Auth:** User JWT required. All roles.

**Request body:**
```json
{
  "storage_path": "employee-documents/uuid/doc.pdf",
  "bucket": "employee-documents"
}
```

**Logic:**
1. Resolve actor and role.
2. Verify actor has access to the requested file based on bucket and role (mirrors storage RLS from ROLE_RULES.md).
3. Generate a presigned URL with 15-minute expiry via Supabase storage.

**Success response (200):**
```json
{ "data": { "url": "https://...", "expires_at": "2026-06-09T10:15:00Z" } }
```

**Error cases:**
- `FORBIDDEN` — actor does not have access to this file/bucket
- `NOT_FOUND` — file does not exist in storage

---

### `bulk-import-employees`
**Path:** `POST /functions/v1/bulk-import-employees`
**Auth:** User JWT required. Role: `owner` only.

**Request body:** `multipart/form-data`
```
file: <CSV or XLSX binary>
```

**CSV columns (required):** `first_name`, `last_name`, `email`, `employment_type`, `join_date`
**CSV columns (optional):** `phone`, `gender`, `date_of_birth`, `department_name`, `designation_name`, `reporting_manager_email`, `current_salary`, `probation_end_date`

**Logic:**
1. Verify actor is owner.
2. Parse file. For each row: validate required fields, validate email format, look up department/designation/manager by name/email.
3. For rows that pass: insert employees (same logic as `create-employee` but in bulk, no Auth accounts created here — send separate welcome emails).
4. For rows that fail: collect errors with row number and reason.
5. Commit successful rows. Return both counts.

**Success response (200):**
```json
{
  "data": {
    "total_rows": 15,
    "success_count": 13,
    "failure_count": 2,
    "failures": [
      { "row": 4, "error": "Email already exists: john@company.com" },
      { "row": 11, "error": "Department not found: 'Enginering' (typo?)" }
    ]
  }
}
```

---

### `update-app-config`
**Path:** `POST /functions/v1/update-app-config`
**Auth:** User JWT required. Role: `owner` only.

**Request body:**
```json
{
  "key": "regularization_window_days",
  "value": "10"
}
```

**Logic:**
1. Verify actor is owner.
2. Validate `key` is one of the known config keys.
3. Validate `value` can be parsed to the expected type (integer, boolean, or time string).
4. Upsert `app_config` row.

**Success response (200):**
```json
{ "data": { "key": "regularization_window_days", "value": "10" } }
```

**Error cases:**
- `VALIDATION_ERROR` — unknown key or value cannot be parsed to expected type

---

## Cron Functions

Cron functions are invoked by Supabase's pg_cron scheduler using the service role key. They do not accept user JWTs. Set `actor_system_function` in all audit log entries.

---

### `auto-checkout`
**Schedule:** Daily at `app_config.auto_checkout_time` IST (default 23:59)
**Logic (BR-ATT-03):**
1. Query all `attendance_records` where `date = today` AND `check_in_time IS NOT NULL` AND `check_out_time IS NULL`.
2. For each: set `check_out_time = auto_checkout_time`, `status = 'incomplete'`.
3. Insert notification for each employee (type: `attendance_incomplete`).

---

### `compute-attendance-status`
**Schedule:** Daily at 00:05 IST
**Logic (BR-ATT-04):**
1. Query all `attendance_records` where `date = yesterday`.
2. For each: recompute `status`, `total_hours`, `overtime_hours`, `is_late` per business rules.
3. Update records.

---

### `late-mark-deduction`
**Schedule:** 1st of each month at 00:10 IST
**Logic (BR-ATT-06):**
1. For each active employee: count `is_late = true` records in the previous month.
2. If count >= `shift.late_mark_threshold`: deduct 0.5 days from leave balance (CL first, then EL, then LWP).
3. Log deduction to `leave_balances.adjusted` with reason `late_mark_deduction`.

---

### `monthly-leave-accrual`
**Schedule:** 1st of each month at 00:15 IST
**Logic (BR-LVE-10):**
1. For each active employee × leave type where `accrual_type = 'monthly'`: credit `accrual_days / 12` to `leave_balances.accrued` for the current year row.

---

### `year-end-leave-rollover`
**Schedule:** January 1st at 00:30 IST
**Logic (BR-LVE-10):**
1. For each active employee × leave type:
   - Compute `carry_forward = min(current_balance, max_carry_forward_days)`.
   - Insert new `leave_balances` row for the new year: `opening_balance = carry_forward`, `carry_forward_amount = carry_forward`.
   - Set `carry_forward_expiry` if configured.
   - If `accrual_type = 'yearly'`: add `accrual_days` to `accrued` of the new row.

---

### `carry-forward-expiry-alert`
**Schedule:** Daily at 09:00 IST
**Logic (BR-LVE-11):**
1. Query `leave_balances` where `carry_forward_expiry IS NOT NULL`.
2. If `carry_forward_expiry = today + 30` or `today + 7`: send email to employee.

---

### `carry-forward-lapse`
**Schedule:** Daily at 00:20 IST
**Logic (BR-LVE-11):**
1. Query `leave_balances` where `carry_forward_expiry = today`.
2. For each: reduce `opening_balance -= carry_forward_amount`, set `carry_forward_amount = 0`.
3. Log to `audit_logs` with `actor_system_function = 'carry_forward_lapse'`.

---

### `comp-off-expiry-alert`
**Schedule:** Daily at 09:05 IST
**Logic (BR-LVE-12):**
1. Query `comp_off_requests` where `status = 'approved'` AND `comp_off_expiry_date = today + 7`.
2. Send email to employee.

---

### `comp-off-lapse`
**Schedule:** Daily at 00:25 IST
**Logic (BR-LVE-12):**
1. Query `comp_off_requests` where `status = 'approved'` AND `comp_off_expiry_date = today`.
2. For each: decrement the corresponding `leave_balances.accrued` by 1 (or `adjusted` if accrued is 0).
3. Log to `audit_logs`.

---

### `leave-sla-escalation`
**Schedule:** Every hour
**Logic (BR-LVE-06):**
1. Query `leave_applications` where `status = 'pending'` AND `escalated_to IS NULL`.
2. For each: compute business days since `applied_at` (excluding weekends and holidays).
3. If business days >= `app_config.leave_sla_business_days`: set `escalated_to = owner.id`, `escalated_at = now()`. Send email + notification to Owner.

---

### `probation-end-alert`
**Schedule:** Daily at 09:10 IST
**Logic (BR-EMP-07):**
1. Query `employees` where `probation_end_date = today + 14` AND `is_active = true`.
2. Send email to Owner for each.

---

### `exit-date-alert`
**Schedule:** Daily at 09:15 IST
1. Query `employees` where `exit_date = today + 7` AND `is_active = true`.
2. Send email to Owner, HR, and System Admin for each.

---

### `access-revocation`
**Schedule:** Daily at 23:55 IST
**Logic (BR-EMP-05):**
1. Query `employees` where `exit_date = today` AND `is_active = true`.
2. For each: set `is_active = false`, invalidate Supabase Auth session (`auth.admin.deleteUser(auth_id)`).

---

### `future-joiner-activation`
**Schedule:** Daily at 00:01 IST
**Logic (BR-EMP-03):**
1. Query `employees` where `employment_status = 'future_joiner'` AND `join_date = today`.
2. For each: set `employment_status = 'active'`.
3. Send welcome email if `is_first_login = true` (first time activation).
4. Create in-app notification for Owner and HR.

---

### `incomplete-attendance-reminder`
**Schedule:** Daily at 09:00 IST
**Logic (BR-ATT-03):**
1. Query `attendance_records` where `date = yesterday` AND `status = 'incomplete'`.
2. For each: send in-app notification to employee (type: `attendance_incomplete`).
