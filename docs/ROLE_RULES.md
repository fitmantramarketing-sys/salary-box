# ROLE_RULES.md
## Internal HR Tool — Role Rules & RLS Strategy
**Source of truth:** HR_Tool_PRD_v1 (June 2026)
**Status:** Implementation-ready specification. No code.

---

## Overview

There are exactly 4 roles: `owner`, `hr`, `employee`, `system_admin`. Role is stored in `employees.role` and is the single source of truth for all access control. Supabase Row Level Security (RLS) enforces data isolation at the database layer — the frontend never determines what data a user can see.

**Key principle:** RLS is defence-in-depth. Even if a bug exists in the frontend, the database refuses to return rows the user should not see.

---

## How Role Is Resolved

1. User logs in via Supabase Auth → receives JWT
2. JWT contains `auth.uid()` (the auth.users.id)
3. All RLS policies look up `employees.role WHERE employees.auth_id = auth.uid()`
4. That `role` value drives every SELECT / INSERT / UPDATE / DELETE policy

**Implementation note:** Create a Supabase database function `get_my_role()` that returns `employees.role WHERE auth_id = auth.uid()`. Use this function in all policies to avoid repeated subqueries and to enable Supabase's policy caching.

---

## Role Definitions

### Owner
- Full access to all data across all tables
- The only role that can configure leave policies, manage roles, and view/edit any employee's bank details
- Receives all executive-level notifications and reports
- Can override any RLS-controlled action (e.g. bank detail edits, past attendance changes)

### HR
- Manages day-to-day operations: employee records, attendance oversight, leave approvals
- Sees all employee profiles and all team attendance
- Cannot configure leave types or manage roles
- Cannot edit bank details of other employees
- Approval authority for leave, regularization, and comp-off requests

### Employee
- Self-service only: sees own data only across all tables
- Can submit leave applications, regularization requests, comp-off requests
- Can view own attendance records, leave balances, documents
- Cannot see any other employee's data

### System Admin
- Read-only access to all data (for support, exports, audits)
- Can manage `ip_whitelist` and `geofence_config`
- Cannot approve leave, edit employee records, or change roles
- Access to `audit_logs` for compliance queries

---

## RLS Policy Per Table

For each table: `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies are listed. "Own record" means `employee_id = (SELECT id FROM employees WHERE auth_id = auth.uid())`.

---

### `employees`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | Own row only | All rows (read-only) |
| INSERT | Yes | No | No | No |
| UPDATE | All rows | All rows (except role, bank details) | Own non-sensitive fields only (see field rules below) | No |
| DELETE | No (soft delete only — set is_active = false) | No | No | No |

**Employee self-update allowed fields:** `phone`, `personal_email`, `address_line1`, `address_line2`, `city`, `state`, `pincode`, `emergency_contact_name`, `emergency_contact_phone`, `photo_url`

**Employee cannot update:** `role`, `employment_status`, `employment_type`, `department_id`, `designation_id`, `reporting_manager_id`, `join_date`, `exit_date`, `current_salary`, `employee_code`, `email`

**HR cannot update:** `role`, `current_salary` (salary revision goes through `employee_lifecycle_events`), `auth_id`

**Additional RLS condition:** Rows where `is_active = false` are hidden from HR and Employee. Owner and System Admin can see inactive rows by explicitly filtering.

**Future joiner visibility:** Rows where `employment_status = 'future_joiner'` are visible to Owner only until `join_date` is reached, then visible to HR as well.

---

### `departments`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | All active rows (for dropdowns) | All rows |
| INSERT | Yes | No | No | No |
| UPDATE | Yes | No | No | No |
| DELETE | No (soft delete via is_active) | No | No | No |

---

### `designations`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | All active rows (for dropdowns) | All rows |
| INSERT | Yes | No | No | No |
| UPDATE | Yes | No | No | No |
| DELETE | No | No | No | No |

---

### `employee_documents`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | Own documents only | All rows (read-only) |
| INSERT | Yes | Yes | Own documents only | No |
| UPDATE | Yes (is_active only for soft delete) | Yes (is_active only) | No | No |
| DELETE | No (soft delete only) | No | No | No |

**Note:** Storage bucket RLS must mirror this — presigned URL generation must verify role before issuing the URL.

---

### `employee_bank_details`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | No (see note) | Own record only (masked display — last4 only) | No |
| INSERT | Yes | No | No | No |
| UPDATE | Yes | No | No | No |
| DELETE | No | No | No | No |

**Note:** HR cannot see bank details of any employee. This is a deliberate security decision per PRD Open Question #7 (recommend: No). The `account_number_encrypted` column must never be returned to the frontend — always strip at the API/Edge Function layer even for Owner.

---

### `employee_lifecycle_events`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | Own events only | All rows |
| INSERT | Yes | Yes | No | No |
| UPDATE | No (immutable) | No | No | No |
| DELETE | No (immutable) | No | No | No |

---

### `onboarding_checklist_templates`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | Active rows only (to display checklist) | All rows |
| INSERT | Yes | No | No | No |
| UPDATE | Yes | No | No | No |
| DELETE | No | No | No | No |

---

### `employee_onboarding_progress`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | Own progress only | All rows |
| INSERT | Yes (on employee creation) | Yes | No | No |
| UPDATE | Yes | Yes | Own items: can mark complete | No |
| DELETE | No | No | No | No |

---

### `shifts`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | Active rows (for display) | All rows |
| INSERT | Yes | Yes | No | No |
| UPDATE | Yes | Yes | No | No |
| DELETE | No | No | No | No |

---

### `department_shifts` and `employee_shift_overrides`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | Own override only | All rows |
| INSERT | Yes | Yes | No | No |
| UPDATE | Yes | Yes | No | No |
| DELETE | Yes | Yes (own team only) | No | No |

---

### `attendance_records`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | Own records only | All rows |
| INSERT | Yes (manual entry only) | Yes (manual entry only) | Via Edge Function only (check-in/out) | No |
| UPDATE | Yes | Yes (except check_in_time, check_out_time directly) | No — must use regularization request | No |
| DELETE | No | No | No | No |

**Critical:** `check_in_time` and `check_out_time` must only be set by Edge Functions, never directly from the client. RLS cannot enforce column-level restrictions — enforce this via the Edge Function contract and API layer.

**Manual entry rule:** When `is_manually_entered = true`, `manual_entry_reason` and `manual_entry_by` must be set. Validated in Edge Function before insert.

---

### `attendance_regularization_requests`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | Own requests only | All rows |
| INSERT | Yes | Yes | Own requests only (max N days back — configurable) | No |
| UPDATE (status change) | Yes | Yes (own team requests) | No | No |
| DELETE | No | No | No | No |

---

### `leave_types`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | Active rows only | All rows |
| INSERT | Yes | No | No | No |
| UPDATE | Yes | No | No | No |
| DELETE | No (soft delete via is_active) | No | No | No |

---

### `leave_balances`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | Own balances only | All rows |
| INSERT | Yes (on new employee, year rollover) | Yes | No | No |
| UPDATE | Yes (manual adjustments) | Yes (manual adjustments) | No | No |
| DELETE | No | No | No | No |

---

### `leave_applications`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | Own applications only | All rows |
| INSERT | Yes | Yes | Own applications only | No |
| UPDATE (status) | Yes | Yes (pending only) | Cancellation of own pending/future approved only | No |
| DELETE | No | No | No | No |

**Cancellation rule:** Employee can cancel their own `pending` applications immediately. Employee can request cancellation of `approved` future applications — this sets a `cancellation_requested` flag (add this column if needed) rather than changing status directly. HR must confirm before status changes to `cancelled`.

---

### `holidays`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | All rows (needed for leave calendar) | All rows |
| INSERT | Yes | Yes | No | No |
| UPDATE | Yes | Yes | No | No |
| DELETE | Yes | Yes | No | No |

---

### `comp_off_requests`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | Own requests only | All rows |
| INSERT | Yes | Yes | Own requests only | No |
| UPDATE (status) | Yes | Yes | No | No |
| DELETE | No | No | No | No |

---

### `ip_whitelist` and `geofence_config`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | All rows | No | All rows |
| INSERT | Yes | No | No | Yes |
| UPDATE | Yes | No | No | Yes |
| DELETE | Yes | No | No | Yes |

---

### `notifications`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | Own notifications only | Own notifications only | Own notifications only | No |
| INSERT | Edge Functions only (no client insert) | — | — | — |
| UPDATE (is_read) | Own only | Own only | Own only | No |
| DELETE | No | No | No | No |

---

### `audit_logs`

| Operation | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| SELECT | All rows | No | No | All rows |
| INSERT | Trigger only (no client insert) | — | — | — |
| UPDATE | No (immutable) | No | No | No |
| DELETE | No | No | No | No |

---

## Supabase Storage RLS

Storage RLS is separate from table RLS. Policies are defined per bucket and mirror the table-level rules.

| Bucket | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| `employee-photos` | Full access | Read all, write own team | Read/write own only | Read all |
| `employee-documents` | Full access | Read/write all | Read/write own only | Read all |
| `lifecycle-documents` | Full access | Read all, write team events | No | Read all |
| `leave-attachments` | Full access | Read all, write own | Read/write own only | Read all |
| `import-exports` | Full access | Read/write own uploads | No | Read all |

Presigned URLs must be generated server-side (Edge Function) after role verification. Never generate presigned URLs directly from the client.

---

## Role Escalation Rules

These are business rules that must be enforced in Edge Functions, not in RLS:

| Scenario | Escalation |
|---|---|
| Leave application pending > 2 business days | Auto-escalate: set `leave_applications.escalated_to` = Owner's employee_id. Notify Owner. |
| HR is on approved leave when leave application arrives | Route to Owner directly at submission time. |
| Regularization request pending > 2 business days | Notify Owner. HR still primary approver. |
| Termination action | Only Owner can set `employment_status = 'terminated'`. HR cannot. |
| Role assignment / change | Only Owner (with System Admin privilege) can change `employees.role`. |
| Bank detail edit | Only Owner can edit. Employee can submit a request which Owner then applies. |

---

## Permission Summary Matrix

| Feature | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| View all employee profiles | YES | YES | Self only | YES (read) |
| Create employee | YES | NO | NO | NO |
| Edit employee (non-sensitive) | YES | YES | Self limited fields | NO |
| Edit employee role | YES | NO | NO | NO |
| Delete / archive employee | YES (soft) | NO | NO | NO |
| View own attendance | YES | YES | YES | YES (read) |
| View all attendance | YES | YES | NO | YES (read) |
| Check in / out | YES | YES | YES | NO |
| Manual attendance entry | YES | YES | NO | NO |
| Approve regularization | YES | YES | NO | NO |
| Configure shifts | YES | YES | NO | NO |
| Configure leave types | YES | NO | NO | NO |
| Apply for leave | YES | YES | YES | NO |
| Approve / reject leave | YES | YES | NO | NO |
| Cancel own leave | YES | YES | YES | NO |
| View leave balances (all) | YES | YES | Self only | YES (read) |
| Manually adjust leave balance | YES | YES | NO | NO |
| Manage holiday calendar | YES | YES | NO | NO |
| Configure IP whitelist | YES | NO | NO | YES |
| Configure geofence | YES | NO | NO | YES |
| View audit logs | YES | NO | NO | YES |
| Generate all reports | YES | NO | NO | YES (read) |
| Generate team reports | YES | YES | NO | NO |
| Generate self reports | YES | YES | YES | NO |
| Export all data | YES | NO | NO | YES |
| Export team data | YES | YES | NO | NO |
| Manage roles and permissions | YES* | NO | NO | NO |
| View bank details | YES | NO | Self (last4 only) | NO |

*Owner can manage roles only when also designated System Admin.
