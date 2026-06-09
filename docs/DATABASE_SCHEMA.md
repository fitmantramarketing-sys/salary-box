# DATABASE_SCHEMA.md
## Internal HR Tool — Supabase PostgreSQL
**Source of truth:** HR_Tool_PRD_v1 (June 2026)
**Region:** ap-south-1 (Mumbai)
**Status:** Implementation-ready specification. No code.

---

## Conventions

- Tables: `snake_case`, plural nouns, `public` schema
- Primary keys: `id uuid DEFAULT gen_random_uuid()`
- Foreign keys: `{referenced_table_singular}_id`
- Timestamps: `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`
- Soft delete: `is_active boolean DEFAULT true` — never hard delete user data
- Enum types: PostgreSQL custom types, domain-prefixed

---

## Enum Types

Define before any dependent table.

| Enum Name | Values |
|---|---|
| `employment_status` | `active`, `on_probation`, `resigned`, `terminated`, `on_leave`, `future_joiner` |
| `employment_type` | `full_time`, `part_time`, `contractor`, `intern` |
| `user_role` | `owner`, `hr`, `employee`, `system_admin` |
| `gender` | `male`, `female`, `other`, `prefer_not_to_say` |
| `attendance_status` | `present`, `absent`, `half_day`, `work_from_home`, `on_leave`, `holiday`, `weekly_off`, `incomplete` |
| `regularization_status` | `pending`, `approved`, `rejected` |
| `leave_status` | `pending`, `approved`, `rejected`, `cancelled` |
| `leave_accrual_type` | `monthly`, `yearly`, `manual` |
| `holiday_type` | `national`, `state`, `company`, `optional` |
| `lifecycle_event_type` | `onboarding`, `promotion`, `transfer`, `salary_revision`, `resignation`, `termination`, `rehire` |

---

## Tables

---

### 1. `employees`

Core master table. Foundation for all other tables. One row per person including Owner and HR.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| auth_id | uuid | YES | — | FK → auth.users.id. NULL until Supabase Auth account created. |
| employee_code | text | NO | — | Auto-generated. Format: EMP-YYYY-NNNN. Unique. |
| first_name | text | NO | — | |
| last_name | text | NO | — | |
| email | text | NO | — | Unique. Work email. Used for Supabase Auth login. |
| phone | text | YES | — | |
| date_of_birth | date | YES | — | |
| gender | gender | YES | — | |
| photo_url | text | YES | — | Supabase Storage path. |
| address_line1 | text | YES | — | |
| address_line2 | text | YES | — | |
| city | text | YES | — | |
| state | text | YES | — | |
| pincode | text | YES | — | |
| emergency_contact_name | text | YES | — | |
| emergency_contact_phone | text | YES | — | |
| personal_email | text | YES | — | Separate from work email. |
| department_id | uuid | YES | — | FK → departments.id. Nullable for C-suite. |
| designation_id | uuid | YES | — | FK → designations.id. |
| reporting_manager_id | uuid | YES | — | FK → employees.id (self-referencing). |
| role | user_role | NO | 'employee' | Drives all RLS policies. |
| employment_type | employment_type | NO | 'full_time' | |
| employment_status | employment_status | NO | 'active' | |
| join_date | date | NO | — | Can be future (status = future_joiner). |
| exit_date | date | YES | — | Set on resignation or termination. |
| probation_end_date | date | YES | — | NULL if not on probation. |
| current_salary | numeric(12,2) | YES | — | v1: record only. v2: feeds payroll. Updated by Edge Function when salary_revision lifecycle event is inserted (BR-EMP-09). |
| previous_employee_id | uuid | YES | — | FK → employees.id. Set on rehire to link old record. |
| is_first_login | boolean | NO | true | Forces password change on first login. |
| is_active | boolean | NO | true | Soft delete. |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| created_by | uuid | YES | — | FK → employees.id. |

**Unique constraints:** `(email)`, `(employee_code)`
**Check constraints:** `exit_date > join_date` when both non-null

**Indexes:**
- `idx_employees_auth_id` on `(auth_id)` — hit on every authenticated request
- `idx_employees_department_id` on `(department_id)`
- `idx_employees_reporting_manager_id` on `(reporting_manager_id)`
- `idx_employees_role` on `(role)` — RLS evaluation
- `idx_employees_employment_status` on `(employment_status)`
- `idx_employees_is_active` on `(is_active)`

---

### 2. `departments`

Self-referencing tree. Max 3 levels enforced in application logic via `depth` column.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | Unique within same parent. |
| parent_id | uuid | YES | — | FK → departments.id. NULL = root. |
| depth | smallint | NO | 0 | 0 = root, 1 = child, 2 = grandchild. App enforces max 2. |
| is_active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| created_by | uuid | YES | — | FK → employees.id. |

**Unique constraints:** `(name, parent_id)`

**Indexes:**
- `idx_departments_parent_id` on `(parent_id)`
- `idx_departments_is_active` on `(is_active)`

---

### 3. `designations`

Job titles, mapped to departments. Can be company-wide (department_id NULL).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| department_id | uuid | YES | — | FK → departments.id. NULL = applicable company-wide. |
| is_active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**Unique constraints:** `(name, department_id)`

**Indexes:**
- `idx_designations_department_id` on `(department_id)`

---

### 4. `employee_documents`

Document vault. One row per document upload per employee.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_id | uuid | NO | — | FK → employees.id |
| document_type | text | NO | — | See check constraint for allowed values. |
| file_name | text | NO | — | Original file name displayed in UI. |
| storage_path | text | NO | — | Supabase Storage path. Format: `employee-documents/{employee_id}/{uuid}.{ext}` |
| file_size_bytes | integer | NO | — | Enforced ≤ 5,242,880 (5 MB). |
| mime_type | text | NO | — | Allowed: `application/pdf`, `image/jpeg`, `image/png` |
| document_hash | text | YES | — | SHA-256 hash of file content. Computed by Edge Function on upload. Used for duplicate PAN/Aadhar detection (BR-EMP-02). |
| uploaded_by | uuid | NO | — | FK → employees.id |
| is_active | boolean | NO | true | Soft delete. |
| created_at | timestamptz | NO | now() | |

**Check constraints:**
- `file_size_bytes <= 5242880`
- `document_type IN ('aadhar', 'pan', 'offer_letter', 'appointment_letter', 'experience_letter', 'other')`

**Partial unique constraint:** `UNIQUE (document_type, document_hash) WHERE document_type IN ('aadhar', 'pan') AND is_active = true` — prevents the same identity document from being stored against two different employees.

**Indexes:**
- `idx_employee_documents_employee_id` on `(employee_id)`
- `idx_employee_documents_type` on `(document_type)`
- `idx_employee_documents_hash` on `(document_type, document_hash)` WHERE `document_type IN ('aadhar', 'pan')` — duplicate detection lookup

---

### 5. `employee_bank_details`

Stored separately from employees for tighter RLS. One active record per employee.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_id | uuid | NO | — | FK → employees.id |
| account_number_encrypted | text | NO | — | Encrypted at application layer before insert. Never stored plain. |
| account_number_last4 | char(4) | NO | — | Plain text. Used for masked display. |
| ifsc_code | text | NO | — | |
| bank_name | text | NO | — | |
| account_holder_name | text | NO | — | |
| is_active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| updated_by | uuid | YES | — | FK → employees.id. |

**Unique constraints:** Partial unique on `(employee_id)` WHERE `is_active = true`

**Indexes:**
- `idx_bank_details_employee_id` on `(employee_id)`

---

### 6. `employee_lifecycle_events`

Immutable history of all lifecycle changes. INSERT only — never UPDATE or DELETE.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_id | uuid | NO | — | FK → employees.id |
| event_type | lifecycle_event_type | NO | — | |
| effective_date | date | NO | — | When the change takes effect. |
| previous_department_id | uuid | YES | — | FK → departments.id. Set on transfer. |
| new_department_id | uuid | YES | — | FK → departments.id. Set on transfer. |
| previous_designation_id | uuid | YES | — | FK → designations.id. Set on promotion. |
| new_designation_id | uuid | YES | — | FK → designations.id. Set on promotion. |
| previous_salary | numeric(12,2) | YES | — | Set on salary revision. |
| new_salary | numeric(12,2) | YES | — | Set on salary revision. Edge Function also updates employees.current_salary on insert (BR-EMP-09). |
| reason | text | YES | — | Mandatory for termination. Optional otherwise. |
| document_path | text | YES | — | Supporting doc in Supabase Storage (termination letter, etc.) |
| performed_by | uuid | NO | — | FK → employees.id. Who triggered the event. |
| created_at | timestamptz | NO | now() | |

**Indexes:**
- `idx_lifecycle_employee_id` on `(employee_id)`
- `idx_lifecycle_event_type` on `(event_type)`
- `idx_lifecycle_effective_date` on `(effective_date)`

---

### 7. `onboarding_checklist_templates`

Owner-configured items applied to every new employee at onboarding.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| item_name | text | NO | — | e.g. 'ID proof submitted', 'Offer letter signed' |
| description | text | YES | — | |
| is_required | boolean | NO | true | |
| sort_order | smallint | NO | 0 | Display order. |
| is_active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |

---

### 8. `employee_onboarding_progress`

Per-employee progress against the checklist template.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_id | uuid | NO | — | FK → employees.id |
| checklist_item_id | uuid | NO | — | FK → onboarding_checklist_templates.id |
| is_completed | boolean | NO | false | |
| completed_at | timestamptz | YES | — | |
| completed_by | uuid | YES | — | FK → employees.id. |

**Unique constraints:** `(employee_id, checklist_item_id)`

**Indexes:**
- `idx_onboarding_progress_employee_id` on `(employee_id)`

---

### 9. `shifts`

Named shift definitions. Assigned to departments or individual employees.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | e.g. 'Morning Shift', 'General Shift' |
| start_time | time | NO | — | |
| end_time | time | NO | — | |
| break_minutes | smallint | NO | 60 | |
| weekly_off_days | smallint[] | NO | `ARRAY[0]` | PostgreSQL array. 0=Sun, 1=Mon…6=Sat. |
| grace_period_minutes | smallint | NO | 15 | Late mark grace. |
| late_mark_threshold | smallint | NO | 3 | N late marks per month = half-day deduction. |
| is_night_shift | boolean | NO | false | Checkout after midnight attributed to previous date. |
| is_active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

---

### 10. `department_shifts`

Default shift per department. Overridden per employee via `employee_shift_overrides`.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| department_id | uuid | NO | — | FK → departments.id |
| shift_id | uuid | NO | — | FK → shifts.id |
| effective_from | date | NO | — | |
| effective_to | date | YES | — | NULL = currently active. |

**Unique constraints:** `(department_id, effective_from)`

---

### 11. `employee_shift_overrides`

Per-employee shift override. Takes precedence over `department_shifts`.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_id | uuid | NO | — | FK → employees.id |
| shift_id | uuid | NO | — | FK → shifts.id |
| effective_from | date | NO | — | |
| effective_to | date | YES | — | NULL = currently active. |
| assigned_by | uuid | NO | — | FK → employees.id. |

**Unique constraints:** `(employee_id, effective_from)`

**Indexes:**
- `idx_shift_overrides_employee_id` on `(employee_id)`

---

### 12. `attendance_records`

One row per employee per calendar date. Upserted by Edge Function on check-in/check-out.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_id | uuid | NO | — | FK → employees.id |
| date | date | NO | — | Calendar date (IST). |
| shift_id | uuid | YES | — | FK → shifts.id. Snapshot of shift at time of record. |
| check_in_time | timestamptz | YES | — | Server-timestamped only. Employee cannot set directly. |
| check_out_time | timestamptz | YES | — | Server-timestamped only. |
| check_in_ip | inet | YES | — | Captured at check-in. |
| check_in_lat | numeric(10,7) | YES | — | GPS latitude at check-in. |
| check_in_lng | numeric(10,7) | YES | — | GPS longitude at check-in. |
| check_out_lat | numeric(10,7) | YES | — | |
| check_out_lng | numeric(10,7) | YES | — | |
| is_geo_flagged | boolean | NO | false | True if GPS pattern looked suspicious. |
| is_wfh | boolean | NO | false | Set by employee (or HR/Owner on manual entry) to indicate Work From Home. Causes nightly computation to set status = 'work_from_home' per BR-ATT-12. |
| status | attendance_status | NO | 'absent' | Computed by Edge Function nightly. |
| total_hours | numeric(4,2) | YES | — | (check_out - check_in) in hours minus break. |
| overtime_hours | numeric(4,2) | YES | — | Hours beyond shift end_time. |
| overtime_approved | boolean | YES | — | NULL = not yet reviewed. |
| overtime_approved_by | uuid | YES | — | FK → employees.id. |
| is_late | boolean | NO | false | True if check_in > shift.start_time + grace_period_minutes. |
| is_manually_entered | boolean | NO | false | True if record was set by Owner/HR manually. |
| manual_entry_reason | text | YES | — | Required when is_manually_entered = true. |
| manual_entry_by | uuid | YES | — | FK → employees.id. |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**Unique constraints:** `(employee_id, date)`

**Indexes:**
- `idx_attendance_employee_date` on `(employee_id, date)` — primary lookup
- `idx_attendance_date` on `(date)` — team calendar queries
- `idx_attendance_status` on `(status)` — report filters
- `idx_attendance_is_late` on `(is_late)` — late mark reports

---

### 13. `attendance_regularization_requests`

Employee requests to correct a past attendance record. Approved by HR/Owner.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_id | uuid | NO | — | FK → employees.id |
| attendance_record_id | uuid | NO | — | FK → attendance_records.id |
| requested_status | attendance_status | NO | — | What the employee requests the status to be changed to. |
| requested_check_in | timestamptz | YES | — | Requested corrected check-in time. |
| requested_check_out | timestamptz | YES | — | Requested corrected check-out time. |
| reason | text | NO | — | |
| status | regularization_status | NO | 'pending' | |
| reviewed_by | uuid | YES | — | FK → employees.id. |
| reviewed_at | timestamptz | YES | — | |
| reviewer_comment | text | YES | — | |
| created_at | timestamptz | NO | now() | |

**Indexes:**
- `idx_regularization_employee_id` on `(employee_id)`
- `idx_regularization_status` on `(status)` — approval queue

**Partial unique index:** `UNIQUE (attendance_record_id) WHERE status = 'pending'` — enforces one active regularization request per attendance record at a time (BR-ATT-08).

---

### 14. `leave_types`

Configurable leave type definitions. Managed by Owner.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | e.g. 'Casual Leave' |
| code | text | NO | — | Short code: CL, SL, EL, ML, CO, LWP. Unique. |
| accrual_type | leave_accrual_type | NO | 'yearly' | |
| accrual_days | numeric(5,2) | YES | — | Days per accrual cycle. NULL for manual. |
| max_carry_forward_days | numeric(5,2) | NO | 0 | 0 = no carry forward. |
| carry_forward_expiry_days | smallint | YES | — | Days after year-end before carry-forward expires. NULL = no expiry. |
| allow_negative_balance | boolean | NO | false | |
| is_encashable | boolean | NO | false | v2 payroll flag. |
| is_lwp | boolean | NO | false | If true, deducted from salary (v2). |
| requires_attachment | boolean | NO | false | |
| attachment_required_after_days | smallint | YES | — | e.g. 2 = required if leave > 2 days. |
| max_consecutive_days | smallint | YES | — | NULL = no cap. Enforced in Edge Function on submission (BR-LVE-15). |
| min_notice_days | smallint | NO | 0 | Advance notice required. Enforced in Edge Function on submission (BR-LVE-16). |
| applicable_gender | gender | YES | — | NULL = all genders. Used for Maternity/Paternity leave. Enforced in Edge Function (BR-LVE-17). |
| is_active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**Unique constraints:** `(code)`

---

### 15. `leave_balances`

Current balance per employee per leave type per year. Updated on every leave approval.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_id | uuid | NO | — | FK → employees.id |
| leave_type_id | uuid | NO | — | FK → leave_types.id |
| year | smallint | NO | — | Calendar year e.g. 2026. |
| opening_balance | numeric(5,2) | NO | 0 | Balance at year start, includes carry-forward from previous year. |
| carry_forward_amount | numeric(5,2) | NO | 0 | The portion of opening_balance that originated from carry-forward. Set at year-end rollover. Used by carry-forward-lapse Edge Function to remove only the carried portion on expiry (BR-LVE-11). |
| accrued | numeric(5,2) | NO | 0 | Total accrued so far this year. |
| taken | numeric(5,2) | NO | 0 | Total approved leaves consumed. |
| pending | numeric(5,2) | NO | 0 | Days held by pending applications. |
| adjusted | numeric(5,2) | NO | 0 | Manual adjustments (positive or negative) by Owner/HR. |
| carry_forward_expiry | date | YES | — | Date the carry-forward portion lapses. |
| updated_at | timestamptz | NO | now() | |

**Computed balance:** `opening_balance + accrued + adjusted - taken` — compute at query time, do not store.

**Unique constraints:** `(employee_id, leave_type_id, year)`

**Indexes:**
- `idx_leave_balances_employee_id` on `(employee_id)`
- `idx_leave_balances_employee_year` on `(employee_id, year)`
- `idx_leave_balances_expiry` on `(carry_forward_expiry)` — expiry alert Edge Function

---

### 16. `leave_applications`

One row per application. Status: pending → approved/rejected, or cancelled.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_id | uuid | NO | — | FK → employees.id |
| leave_type_id | uuid | NO | — | FK → leave_types.id |
| from_date | date | NO | — | |
| to_date | date | NO | — | |
| working_days_count | numeric(4,2) | NO | — | Computed at submission: holidays and weekly-offs excluded. Immutable after INSERT. |
| is_half_day | boolean | NO | false | |
| half_day_period | text | YES | — | `morning` or `afternoon`. Set only when is_half_day = true. |
| reason | text | NO | — | |
| attachment_path | text | YES | — | Supabase Storage path. |
| status | leave_status | NO | 'pending' | |
| applied_at | timestamptz | NO | now() | Immutable after INSERT. |
| reviewed_by | uuid | YES | — | FK → employees.id. Set only when an actual review action occurs, never pre-assigned. |
| reviewed_at | timestamptz | YES | — | |
| reviewer_comment | text | YES | — | |
| cancelled_by | uuid | YES | — | FK → employees.id. |
| cancelled_at | timestamptz | YES | — | |
| cancellation_reason | text | YES | — | |
| escalated_to | uuid | YES | — | FK → employees.id. Set when HR is on leave at submission time (BR-LVE-07) or when leave SLA is breached (BR-LVE-06). |
| escalated_at | timestamptz | YES | — | |
| cancellation_requested | boolean | NO | false | Set to true when employee requests cancellation of an approved future leave. Status does not change to 'cancelled' until HR/Owner confirms (BR-LVE-09). |
| cancellation_requested_at | timestamptz | YES | — | Timestamp when the cancellation request was submitted. |

**Check constraints:**
- `to_date >= from_date`
- `working_days_count > 0`
- `half_day_period IN ('morning','afternoon') OR is_half_day = false`

**Indexes:**
- `idx_leave_applications_employee_id` on `(employee_id)`
- `idx_leave_applications_status` on `(status)` — approval queue
- `idx_leave_applications_from_date` on `(from_date)` — calendar rendering
- `idx_leave_applications_reviewed_by` on `(reviewed_by)` — HR queue view
- `idx_leave_applications_cancellation_requested` on `(cancellation_requested)` WHERE `cancellation_requested = true` — cancellation queue

---

### 17. `holidays`

Company-wide holiday calendar. Seeded for India national holidays; extended by Owner/HR.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| date | date | NO | — | |
| name | text | NO | — | e.g. 'Republic Day', 'Diwali' |
| type | holiday_type | NO | — | |
| is_optional | boolean | NO | false | Optional holidays: employee may opt in up to `app_config.optional_holiday_limit_per_year` per year. |
| state_code | text | YES | — | ISO state code. NULL = applicable to all states. e.g. 'GJ' for Gujarat. |
| year | smallint | NO | — | |
| created_at | timestamptz | NO | now() | |

**Unique constraints:** `(date, type)`

**Indexes:**
- `idx_holidays_date` on `(date)` — working-day computation during leave application
- `idx_holidays_year` on `(year)`

---

### 18. `comp_off_requests`

Compensatory off earned by working on holidays or weekly-offs.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_id | uuid | NO | — | FK → employees.id |
| worked_date | date | NO | — | The holiday/weekly-off date that was worked. |
| hours_worked | numeric(4,2) | YES | — | |
| reason | text | YES | — | |
| status | regularization_status | NO | 'pending' | |
| reviewed_by | uuid | YES | — | FK → employees.id. |
| reviewed_at | timestamptz | YES | — | |
| reviewer_comment | text | YES | — | |
| comp_off_expiry_date | date | YES | — | Set on approval. Default: worked_date + app_config.comp_off_expiry_days (default 60). |
| leave_balance_id | uuid | YES | — | FK → leave_balances.id. Set on approval. |
| created_at | timestamptz | NO | now() | |

**Indexes:**
- `idx_comp_off_employee_id` on `(employee_id)`
- `idx_comp_off_status` on `(status)`

---

### 19. `ip_whitelist`

Approved office IP ranges for check-in restriction. Managed by System Admin.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| label | text | NO | — | e.g. 'Head Office', 'Branch — Surat' |
| ip_range | cidr | NO | — | CIDR notation. e.g. 192.168.1.0/24 |
| is_active | boolean | NO | true | |
| created_by | uuid | NO | — | FK → employees.id. |
| created_at | timestamptz | NO | now() | |

---

### 20. `geofence_config`

GPS geofence centres for mobile check-in validation.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| label | text | NO | — | e.g. 'Main Office' |
| latitude | numeric(10,7) | NO | — | Centre point. |
| longitude | numeric(10,7) | NO | — | Centre point. |
| radius_meters | integer | NO | 100 | |
| is_active | boolean | NO | true | |
| created_by | uuid | NO | — | FK → employees.id. |
| created_at | timestamptz | NO | now() | |

---

### 21. `notifications`

In-app notification store. Written by Edge Functions. Read via Supabase Realtime.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| recipient_id | uuid | NO | — | FK → employees.id |
| title | text | NO | — | Short text for bell dropdown. |
| body | text | NO | — | Full notification text. |
| type | text | NO | — | e.g. `leave_approved`, `regularization_pending`, `attendance_incomplete` |
| reference_id | uuid | YES | — | PK of the related record. |
| reference_table | text | YES | — | Table name of reference_id. |
| is_read | boolean | NO | false | |
| read_at | timestamptz | YES | — | |
| created_at | timestamptz | NO | now() | |

**Indexes:**
- `idx_notifications_recipient_unread` on `(recipient_id, is_read)` — unread count and bell dropdown

---

### 22. `audit_logs`

Immutable. Written by database triggers after every INSERT, UPDATE, DELETE on all user-data tables. Never updated or deleted within the 3-year retention window.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| table_name | text | NO | — | Name of affected table. |
| record_id | uuid | NO | — | PK of the affected row. |
| action | text | NO | — | `INSERT`, `UPDATE`, `DELETE` |
| actor_id | uuid | YES | — | FK → employees.id. NULL if triggered by system/Edge Function. |
| actor_role | user_role | YES | — | Snapshot of actor's role at time of action. |
| actor_system_function | text | YES | — | Set when action is triggered by a scheduled Edge Function (e.g. 'auto_checkout', 'year_end_rollover'). NULL when actor_id is set. Mutually exclusive with actor_id. |
| old_data | jsonb | YES | — | Previous row. NULL on INSERT. PII columns excluded (see below). |
| new_data | jsonb | YES | — | New row. NULL on DELETE. PII columns excluded. |
| ip_address | inet | YES | — | Client IP if available from request context. |
| created_at | timestamptz | NO | now() | |

**PII exclusion in trigger:** `account_number_encrypted` must be stripped from `old_data`/`new_data` before insert. Replace with `{"masked": true}`.

**Retention:** 3 years from `created_at`. Archive after; do not delete.

**Indexes:**
- `idx_audit_table_record` on `(table_name, record_id)` — activity timeline per record
- `idx_audit_actor_id` on `(actor_id)`
- `idx_audit_created_at` on `(created_at)` — time-range queries
- `idx_audit_table_name` on `(table_name)`

---

### 23. `app_config`

System-level configuration values. Managed by Owner via Settings (S-39). Read by Edge Functions and the API layer. Seeded with defaults at deployment.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| key | text | NO | — | PK. Config key identifier. |
| value | text | NO | — | Config value stored as text; parsed to the appropriate type by the consumer. |
| description | text | YES | — | Human-readable explanation of the config key. |
| updated_by | uuid | YES | — | FK → employees.id. |
| updated_at | timestamptz | NO | now() | |

**Known config keys:**

| Key | Value Type | Default | Description |
|---|---|---|---|
| `regularization_window_days` | integer | `7` | Max past calendar days an employee can submit a regularization request for. |
| `comp_off_expiry_days` | integer | `60` | Days after worked_date before an approved comp-off balance expires. |
| `leave_sla_business_days` | integer | `2` | Business days before a pending leave application is escalated to Owner. |
| `optional_holiday_limit_per_year` | integer | `2` | Max optional holidays an employee can opt into per calendar year. |
| `auto_checkout_time` | time string | `23:59:00` | IST time at which the auto-checkout Edge Function triggers each night. |
| `rehire_carry_leave_balance` | boolean | `false` | If `true`, carry over remaining leave balance on rehire; if `false`, reset to zero. |

---

### 24. `employee_optional_holidays`

Tracks which optional holidays each employee has opted into for the year. Bounded by `app_config.optional_holiday_limit_per_year`. Used in working-day computation (BR-LVE-01) and attendance status computation (BR-ATT-04).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_id | uuid | NO | — | FK → employees.id |
| holiday_id | uuid | NO | — | FK → holidays.id. Must reference a holiday where `is_optional = true`. Validated in Edge Function on insert. |
| year | smallint | NO | — | Calendar year. Denormalised from `holidays.year` for fast per-year queries. |
| created_at | timestamptz | NO | now() | |

**Unique constraints:** `(employee_id, holiday_id)`

**Indexes:**
- `idx_optional_holidays_employee_year` on `(employee_id, year)` — opt-in limit check and working-day computation

---

## Trigger Requirements

### `set_updated_at()` trigger
- Type: `BEFORE UPDATE`
- Attach to: every table with an `updated_at` column

### `log_changes()` trigger
- Type: `AFTER INSERT OR UPDATE OR DELETE`
- Attach to: `employees`, `departments`, `designations`, `employee_documents`, `employee_bank_details`, `employee_lifecycle_events`, `attendance_records`, `attendance_regularization_requests`, `leave_types`, `leave_balances`, `leave_applications`, `comp_off_requests`, `shifts`, `department_shifts`, `employee_shift_overrides`, `holidays`, `onboarding_checklist_templates`, `ip_whitelist`, `geofence_config`, `app_config`, `employee_optional_holidays`
- Skip: `notifications`, `audit_logs`

---

## Storage Buckets

| Bucket | Purpose | Default Access |
|---|---|---|
| `employee-photos` | Profile photos | Authenticated read (own); Owner/HR read all |
| `employee-documents` | Aadhar, PAN, offer letters, certificates | Employee: own only. Owner/HR: all. Presigned URLs only. |
| `lifecycle-documents` | Termination letters, transfer documents | Owner/HR only |
| `leave-attachments` | Medical certificates, leave attachments | Employee: own. Owner/HR: all. |
| `import-exports` | Temporary bulk import/export files | Owner/HR only. Auto-expire 24h. |

All buckets are **private**. No public access. Files served via presigned URLs with 15-minute expiry.

---

## Relationship Map

```
auth.users
  └─► employees (auth_id)
        ├─► departments (department_id)
        │     └─► departments (parent_id, self-ref)
        │     └─► designations (department_id)
        │     └─► department_shifts ──► shifts
        ├─► designations (designation_id)
        ├─► employees (reporting_manager_id, self-ref)
        ├─► employees (previous_employee_id, self-ref rehire)
        ├─► employee_documents
        ├─► employee_bank_details
        ├─► employee_lifecycle_events
        ├─► employee_onboarding_progress ──► onboarding_checklist_templates
        ├─► employee_shift_overrides ──► shifts
        ├─► attendance_records
        │     └─► attendance_regularization_requests
        ├─► leave_balances ──► leave_types
        │     └─► comp_off_requests
        ├─► leave_applications ──► leave_types
        ├─► employee_optional_holidays ──► holidays
        ├─► notifications
        └─► audit_logs
app_config (standalone — no FK to employees; updated_by is nullable)
```
