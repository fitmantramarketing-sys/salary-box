# SCREEN_INVENTORY.md
## Internal HR Tool — Complete Screen Inventory
**Source of truth:** HR_Tool_PRD_v1 (June 2026)
**Status:** Implementation-ready specification. No code.

---

## Overview

Every route in the application is listed here. For each screen: the route, who can access it, what they see (role-dependent), primary data tables queried, and key actions available.

Screens render differently by role — the same route shows different UI to Owner/HR vs Employee. This is handled by a `useRole()` hook in the frontend that reads the role from auth context and conditionally renders components.

---

## Route Structure

```
/login
/set-password                          ← first login only
/dashboard

/employees
/employees/new
/employees/:id
/employees/:id/edit
/employees/import

/attendance
/attendance/:employeeId
/attendance/team

/leave
/leave/apply
/leave/:applicationId
/leave/policies
/leave/holidays
/leave/comp-off/request

/reports
/reports/attendance
/reports/leave
/reports/headcount
/reports/regularization
/reports/heatmap

/settings
/settings/departments
/settings/designations
/settings/shifts
/settings/roles
/settings/ip-whitelist
/settings/geofence
/settings/notifications
/settings/onboarding-checklist
/settings/app-config
```

---

## Screens

---

### AUTH SCREENS

---

#### S-01 — Login Page
**Route:** `/login`
**Access:** Public (unauthenticated)
**Both roles see:** Email + password fields, company logo, "Forgot password" link
**Actions:** Submit credentials → Supabase Auth → redirect to `/dashboard` (or `/set-password` if `is_first_login = true`)
**Data:** No DB query. Supabase Auth only.
**Edge cases:** Failed login shows generic error (do not reveal if email exists). Lockout handled by Supabase Auth natively.

---

#### S-02 — Set Password (First Login)
**Route:** `/set-password`
**Access:** Authenticated, `is_first_login = true` only. Redirect to `/dashboard` if already set.
**All roles see:** New password field, confirm password field, password strength indicator
**Actions:** Submit → update Supabase Auth password → set `employees.is_first_login = false` → redirect to `/dashboard`
**Data:** `employees` (update `is_first_login`)

---

#### S-03 — Forgot Password
**Route:** `/forgot-password`
**Access:** Public
**All roles see:** Email input. "Send reset link" button.
**Actions:** Supabase Auth password reset email flow.

---

### DASHBOARD

---

#### S-04 — Dashboard
**Route:** `/dashboard`
**Access:** All authenticated roles

**Owner sees:**
- Total headcount, active employees, on leave today count
- Pending leave approvals count
- Pending regularization requests count
- Employees on probation (expiring within 14 days)
- Quick link to all reports

**HR sees:**
- Check-in status summary (who has checked in today, who hasn't)
- Pending leave approvals queue (count + quick approve/reject)
- Pending cancellation requests count (leave applications with cancellation_requested = true)
- Pending regularization requests (count)
- Team on leave today (names)
- Upcoming exits (exit_date within 7 days)

**Employee sees:**
- Check-in / check-out button (prominent, primary action)
- Log WFH button (for today — toggles is_wfh on today's attendance record)
- Today's attendance status
- Leave balance cards (per leave type)
- Upcoming approved leaves
- Onboarding checklist (if not 100% complete)
- Any pending notifications

**System Admin sees:**
- System health indicators (placeholder for v1)
- Audit log quick view (last 10 entries)
- IP whitelist status

**Primary tables:** `employees`, `attendance_records`, `leave_applications`, `leave_balances`, `notifications`, `employee_onboarding_progress`

---

### EMPLOYEE MODULE

---

#### S-05 — Employee List
**Route:** `/employees`
**Access:** Owner, HR (full list); Employee (redirected to own profile `/employees/:ownId`)

**Owner / HR sees:**
- Table with: photo, name, employee code, department, designation, employment type, status, join date, actions
- Search bar (name, code, department, designation)
- Filters: department, employment type, status, employment_status
- Add Employee button (Owner only)
- Bulk Import button (Owner only)
- Export CSV/XLSX button

**Primary tables:** `employees`, `departments`, `designations`
**Key actions:** Add employee, bulk import, export, click row → `/employees/:id`

---

#### S-06 — Add Employee (Multi-step Form)
**Route:** `/employees/new`
**Access:** Owner only

**Steps:**
1. Personal Info: first name, last name, work email, phone, DOB, gender, personal email, address
2. Job Details: department, designation, reporting manager, employment type, join date, probation end date, current salary
3. Documents: file upload for Aadhar, PAN, offer letter, appointment letter. Each optional at onboarding.
4. Bank Details: account number, IFSC, bank name, account holder name. Entirely optional at onboarding.

**Review step:** Summary of all entered data before submission.

**On submit:** Employee record created, Supabase Auth account created, welcome email sent, `is_first_login = true`, onboarding checklist rows created for this employee.

**Primary tables (write):** `employees`, `employee_documents`, `employee_bank_details`, `employee_onboarding_progress`
**Edge cases:** Duplicate email → block with message. Duplicate PAN/Aadhar → block (via document_hash), allow Owner override with reason.

---

#### S-07 — Employee Profile (Admin View)
**Route:** `/employees/:id` (when accessed by Owner/HR)
**Access:** Owner, HR, System Admin (read-only)

**Tabs:**
1. **Overview:** Personal info, employment details, reporting manager, current status
2. **Documents:** List of uploaded documents with download links. Upload new document button.
3. **Bank Details:** Owner sees masked view (last4). Edit button (Owner only).
4. **Lifecycle History:** Timeline of all `employee_lifecycle_events` entries
5. **Attendance:** Summary of current month attendance. Link to full attendance view.
6. **Leave:** Current leave balances per type. Recent applications.
7. **Onboarding:** Checklist progress.
8. **Org Chart** (P2): Auto-generated org chart showing this employee's position. Clickable nodes.

**Actions (Owner):** Edit profile, lifecycle events (promote, transfer, salary revision, resign, terminate), deactivate
**Actions (HR):** Edit non-sensitive fields, add documents, add lifecycle events (non-termination, non-salary-revision)

**Primary tables:** `employees`, `departments`, `designations`, `employee_documents`, `employee_bank_details`, `employee_lifecycle_events`, `attendance_records`, `leave_balances`, `leave_applications`, `employee_onboarding_progress`

---

#### S-08 — Edit Employee
**Route:** `/employees/:id/edit`
**Access:** Owner (all fields), HR (limited fields per ROLE_RULES)
**Layout:** Same fields as S-06 but in single-page edit mode with sections
**Primary tables (write):** `employees`, `employee_lifecycle_events` (for designation/department changes)

---

#### S-09 — Employee Profile (Self View)
**Route:** `/employees/:id` (when `id` = own id, accessed by Employee)
**Access:** Employee (own profile only)

**Tabs:**
1. **My Profile:** Personal info (editable fields highlighted), photo upload. Non-editable fields shown greyed.
2. **My Documents:** Own documents. Download only. Upload own documents.
3. **Onboarding:** Own checklist progress. Mark items complete.

**Actions:** Edit allowed fields (phone, personal email, address, emergency contact, photo), submit profile edit request for restricted fields
**Primary tables:** `employees`, `employee_documents`, `employee_onboarding_progress`

---

#### S-10 — Bulk Employee Import
**Route:** `/employees/import`
**Access:** Owner only

**Steps:**
1. Download CSV template
2. Upload filled CSV/XLSX
3. Preview table showing parsed rows with validation status per row (pass/fail with error reason)
4. Confirm import — only valid rows committed. Failed rows downloadable as error CSV.

**Primary tables (write):** `employees`

---

### ATTENDANCE MODULE

---

#### S-11 — Attendance Dashboard (Admin)
**Route:** `/attendance`
**Access:** Owner, HR

**Owner / HR sees:**
- Month/week selector
- Team attendance grid: rows = employees, columns = days, cells = colour-coded status
- Status legend (includes WFH)
- Summary row: total present %, total absent, total on leave, total WFH per day
- Filters: department, employee
- Export to CSV button
- Quick action: approve pending regularization (badge count on nav)
- Pending cancellation requests badge (leave applications with cancellation_requested = true)

**Primary tables:** `attendance_records`, `employees`, `departments`, `holidays`

---

#### S-12 — Employee Attendance Drill-Down (Admin)
**Route:** `/attendance/:employeeId`
**Access:** Owner, HR

**Shows:**
- Employee name, photo, department
- Month selector
- Calendar showing daily status (including WFH) with check-in/check-out times on hover
- Summary: present days, WFH days, absent, late marks, overtime hours
- Regularization requests for this employee (pending, history)
- Manual entry button (Owner/HR) — includes WFH toggle
- Overtime approval table

**Primary tables:** `attendance_records`, `attendance_regularization_requests`, `employees`, `shifts`

---

#### S-13 — My Attendance (Employee)
**Route:** `/attendance` (employee role)
**Access:** Employee

**Shows:**
- Check-in / check-out button (if not already on dashboard — same component)
- Log WFH button — visible if not yet checked in and WFH not already logged today. Calls Edge Function to set `is_wfh = true` on today's attendance record.
- Current month calendar (own records only), colour-coded (WFH shown distinctly)
- Drill-down: click a day → see check-in time, check-out time, total hours, status, WFH flag
- Summary: present count, WFH count, absent, late marks, leaves taken this month
- Regularization request button (for past N days only — N from app_config)
- Regularization history: own requests with status

**Primary tables:** `attendance_records`, `attendance_regularization_requests`, `shifts`, `app_config`

---

#### S-14 — Regularization Request Form
**Route:** Modal or `/attendance/regularize/:date` (employee)
**Access:** Employee (own records only, within allowed past-days window from app_config)

**Fields:** Date (pre-filled), requested status (includes WFH option), requested check-in time (optional), requested check-out time (optional), reason (required)
**On submit:** Creates `attendance_regularization_requests` row, notifies HR/Owner.
**Primary tables (write):** `attendance_regularization_requests`

---

### LEAVE MODULE

---

#### S-15 — Leave Dashboard (Admin)
**Route:** `/leave`
**Access:** Owner, HR

**Shows:**
- Pending approvals queue: list of pending `leave_applications` with employee name, type, dates, days count. Approve/reject inline with optional comment.
- Pending cancellation queue: list of applications where `cancellation_requested = true`. Confirm/reject cancellation inline.
- Team leave calendar: monthly view, colour-coded by leave type. Who is on leave on each day.
- Leave balance overview table: all employees × all leave types.
- Filters: department, leave type, date range.

**Primary tables:** `leave_applications`, `leave_balances`, `leave_types`, `employees`, `holidays`

---

#### S-16 — Leave Dashboard (Employee)
**Route:** `/leave` (employee role)
**Access:** Employee

**Shows:**
- Balance cards: one card per active leave type. Shows available balance, taken, pending.
- Apply Leave button (primary CTA).
- My leave history: all applications, sortable by date, status badge. Cancellation-requested applications shown with a distinct badge.
- Upcoming approved leaves highlighted.
- Comp-off history: list of all comp-off requests with status, worked date, expiry date, and credit balance.
- Request Comp-Off button → navigates to S-21.

**Primary tables:** `leave_balances`, `leave_applications`, `leave_types`, `comp_off_requests`

---

#### S-17 — Apply Leave Form
**Route:** `/leave/apply`
**Access:** Owner, HR, Employee

**Fields:**
- Leave type (dropdown of active types available to this employee — filtered by applicable_gender if set)
- Date range picker (holidays greyed, existing leaves highlighted, optional holidays shown if opted in)
- Working days count display (computed live, auto-excludes holidays and weekly-offs)
- Half-day toggle (if single day) → morning / afternoon selector
- Reason (text, required)
- Attachment upload (required if `leave_type.requires_attachment = true` or if > `attachment_required_after_days`)
- Current balance for selected type shown live

**Validations before submit (Edge Function enforces all):**
- Balance sufficient (or LWP warning if negative allowed) — BR-LVE-02
- No overlapping pending/approved leave for same date range — BR-LVE-03
- Min notice days satisfied (Owner/HR exempt) — BR-LVE-16
- Max consecutive days not exceeded — BR-LVE-15
- Employee gender matches applicable_gender of leave type — BR-LVE-17
- Attachment present if required — BR-LVE-13

**On submit:** Creates `leave_applications` row, holds `working_days_count` in `leave_balances.pending`, notifies HR/Owner (or Owner directly if manager is on leave).

**Primary tables (write):** `leave_applications`, `leave_balances` (pending update)

---

#### S-18 — Leave Application Detail
**Route:** `/leave/:applicationId`
**Access:** Owner, HR (any application); Employee (own only)

**Shows:**
- Application details: type, dates, days, reason, attachment
- Status badge + timeline (applied → reviewed)
- Reviewer comment
- Cancellation option: "Cancel" if status = pending; "Request Cancellation" if status = approved and from_date > today
- If cancellation_requested = true: shows "Cancellation Pending Confirmation" banner

**Actions (HR/Owner):** Approve with comment, reject with comment (on pending only); Confirm or reject cancellation (on cancellation_requested = true)
**Actions (Employee):** Cancel if pending; request cancellation if approved future

**Primary tables:** `leave_applications`, `employees`, `leave_types`

---

#### S-19 — Leave Policy Configuration
**Route:** `/leave/policies`
**Access:** Owner only

**Shows:**
- List of all leave types with their configuration
- Edit button per type, Add new type button
- Toggle active/inactive per type

**Edit form fields:** All columns from `leave_types` table (see DATABASE_SCHEMA.md), including max_consecutive_days, min_notice_days, applicable_gender

**Primary tables (write):** `leave_types`

---

#### S-20 — Holiday Calendar Management
**Route:** `/leave/holidays`
**Access:** Owner, HR (view and manage); Employee (view and opt-in)

**Owner/HR sees:**
- Full year calendar with holidays marked
- Add/edit/delete holiday buttons
- Holiday type filter (national, state, company, optional)

**Employee sees:**
- Read-only calendar showing holidays applicable to them
- Optional holidays marked with an "Opt In" / "Opted In" toggle button
- Counter showing remaining optional holiday opt-ins (e.g. "1 of 2 used")
- Opt-in is only available for future dates

**Primary tables (read):** `holidays`, `employee_optional_holidays`, `app_config`
**Primary tables (write):** `holidays` (Owner/HR); `employee_optional_holidays` (Employee opt-in/out)

---

#### S-21 — Comp-Off Request Form
**Route:** Modal or `/leave/comp-off/request`
**Access:** Employee, HR, Owner

**Fields:** Date worked (must be a holiday or weekly-off), hours worked, reason
**On submit:** Creates `comp_off_requests` row, notifies HR/Owner
**Primary tables (write):** `comp_off_requests`

---

### REPORTS MODULE

---

#### S-22 — Reports Home
**Route:** `/reports`
**Access:** Owner, HR (team reports), Employee (self reports), System Admin (read)

**Shows:** Cards linking to each available report based on role.

---

#### S-23 — Monthly Attendance Summary Report
**Route:** `/reports/attendance`
**Access:** Owner, HR

**Filters:** Month, year, department, employee (optional)
**Shows:** Table: employee name, present days, WFH days, absent days, on leave days, late marks, overtime hours
**Actions:** Export to CSV

**Primary tables:** `attendance_records`, `employees`, `departments`

---

#### S-24 — Absenteeism Report
**Route:** `/reports/attendance` (tab or query param)
**Access:** Owner

**Filters:** Date range, absence threshold (N days), department
**Shows:** Employees with absences > threshold. Name, department, absent count, dates.
**Primary tables:** `attendance_records`, `employees`

---

#### S-25 — Leave Balance Report
**Route:** `/reports/leave`
**Access:** Owner, HR

**Filters:** Year, department, leave type
**Shows:** Table: employee name × leave type columns showing available balance
**Actions:** Export to CSV
**Primary tables:** `leave_balances`, `leave_types`, `employees`

---

#### S-26 — Headcount Report
**Route:** `/reports/headcount`
**Access:** Owner, System Admin

**Filters:** Date range, department, employment_status, employment_type
**Shows:** Counts by status (active, on_probation, resigned, terminated). List with join/exit dates.
**Actions:** Export to CSV
**Primary tables:** `employees`, `departments`

---

#### S-27 — Regularization Log
**Route:** `/reports/regularization`
**Access:** Owner

**Filters:** Date range, department, status
**Shows:** All regularization requests: employee name, date, requested status, reason, approver, outcome.
**Actions:** Export to CSV
**Primary tables:** `attendance_regularization_requests`, `employees`

---

#### S-28 — Department Attendance Heatmap
**Route:** `/reports/heatmap`
**Access:** Owner

**Filters:** Month/year, departments
**Shows:** Heatmap grid — departments on Y axis, days on X axis, cell colour = attendance % (green → red)
**Primary tables:** `attendance_records`, `employees`, `departments`

---

#### S-29 — My Attendance Report (Employee Self)
**Route:** `/reports/attendance` (employee role)
**Access:** Employee

**Filters:** Month selector
**Shows:** Own monthly attendance: days breakdown (including WFH count), check-in/check-out times per day
**Actions:** Export to CSV (own data only)
**Primary tables:** `attendance_records`

---

#### S-30 — My Leave Summary (Employee Self)
**Route:** `/reports/leave` (employee role)
**Access:** Employee

**Shows:** Visual summary: per leave type — allotted, taken, pending, available. Leave history table. Comp-off summary: credited, used, expiring.
**Primary tables:** `leave_balances`, `leave_applications`, `leave_types`, `comp_off_requests`

---

### SETTINGS MODULE

---

#### S-31 — Department Management
**Route:** `/settings/departments`
**Access:** Owner

**Shows:** Tree view of departments (max 3 levels). Add, rename, move, deactivate options.
**Actions:** Create root department, create sub-department, rename, deactivate (only if no active employees assigned)
**Primary tables (write):** `departments`

---

#### S-32 — Designation Management
**Route:** `/settings/designations`
**Access:** Owner

**Shows:** List of designations grouped by department. Add, edit, deactivate.
**Primary tables (write):** `designations`

---

#### S-33 — Shift Management
**Route:** `/settings/shifts`
**Access:** Owner, HR

**Shows:** List of named shifts with their config. Add, edit, deactivate.
**Department assignment:** Assign default shift to department.
**Employee override:** Assign different shift to individual employee.
**Primary tables (write):** `shifts`, `department_shifts`, `employee_shift_overrides`

---

#### S-34 — Role & Access Management
**Route:** `/settings/roles`
**Access:** Owner (with System Admin privilege) only

**Shows:** Employee list with their current role. Role dropdown per row to change.
**Warning:** Changing a role takes effect immediately on the employee's next request.
**Primary tables (write):** `employees` (role column only)

---

#### S-35 — IP Whitelist Management
**Route:** `/settings/ip-whitelist`
**Access:** Owner, System Admin

**Shows:** List of whitelisted IP ranges. Add, label, deactivate.
**Primary tables (write):** `ip_whitelist`

---

#### S-36 — Geofence Configuration
**Route:** `/settings/geofence`
**Access:** Owner, System Admin

**Shows:** Map with draggable pin and radius slider. List of configured geofences.
**Primary tables (write):** `geofence_config`

---

#### S-37 — Notification Preferences
**Route:** `/settings/notifications`
**Access:** Owner (company-wide settings)

**Shows:** Toggles per notification type (email, in-app). SLA thresholds for escalation.
**Note:** v1 implementation: these are stored as `app_config`, not per-employee preferences.

---

#### S-38 — Onboarding Checklist Template
**Route:** `/settings/onboarding-checklist`
**Access:** Owner

**Shows:** List of checklist items with drag-to-reorder, required toggle, edit, delete.
**Primary tables (write):** `onboarding_checklist_templates`

---

#### S-39 — App Configuration
**Route:** `/settings/app-config`
**Access:** Owner only

**Shows:**
- Table of all `app_config` entries: key, current value, description, last updated by, last updated at
- Edit button per row — opens inline edit for the value field
- Values are validated by type before save (e.g. integers must be numeric, times must be HH:MM:SS)

**Known config keys surfaced here:** `regularization_window_days`, `comp_off_expiry_days`, `leave_sla_business_days`, `optional_holiday_limit_per_year`, `auto_checkout_time`, `rehire_carry_leave_balance`

**Primary tables (write):** `app_config`

---

## Screen × Role Access Summary

| Screen | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| S-01 Login | ✓ | ✓ | ✓ | ✓ |
| S-02 Set Password | ✓ | ✓ | ✓ | ✓ |
| S-04 Dashboard | Full | HR view | Employee view | Admin view |
| S-05 Employee List | Full | Full | Redirect to own | Read-only |
| S-06 Add Employee | ✓ | ✗ | ✗ | ✗ |
| S-07 Profile (admin) | Full | Limited fields | ✗ | Read-only |
| S-08 Edit Employee | Full | Limited | ✗ | ✗ |
| S-09 Profile (self) | ✓ | ✓ | ✓ | ✗ |
| S-10 Bulk Import | ✓ | ✗ | ✗ | ✗ |
| S-11 Attendance (admin) | ✓ | ✓ | ✗ | Read-only |
| S-12 Attendance drill-down | ✓ | ✓ | ✗ | Read-only |
| S-13 My Attendance | ✓ | ✓ | ✓ | ✗ |
| S-14 Regularization form | ✓ | ✓ | ✓ (own) | ✗ |
| S-15 Leave (admin) | ✓ | ✓ | ✗ | ✗ |
| S-16 Leave (employee) | ✓ | ✓ | ✓ | ✗ |
| S-17 Apply Leave | ✓ | ✓ | ✓ | ✗ |
| S-18 Leave detail | ✓ | ✓ | Own only | ✗ |
| S-19 Leave policies | ✓ | ✗ | ✗ | ✗ |
| S-20 Holiday calendar | Full | Full | Opt-in only | ✗ |
| S-21 Comp-off request | ✓ | ✓ | ✓ | ✗ |
| S-22 Reports home | ✓ | Team reports | Self reports | Read-only |
| S-23 Attendance report | ✓ | ✓ | ✗ | ✗ |
| S-24 Absenteeism report | ✓ | ✗ | ✗ | ✗ |
| S-25 Leave balance report | ✓ | ✓ | ✗ | ✗ |
| S-26 Headcount report | ✓ | ✗ | ✗ | ✓ |
| S-27 Regularization log | ✓ | ✗ | ✗ | ✗ |
| S-28 Heatmap | ✓ | ✗ | ✗ | ✗ |
| S-29 My attendance report | ✓ | ✓ | ✓ | ✗ |
| S-30 My leave summary | ✓ | ✓ | ✓ | ✗ |
| S-31 Departments | ✓ | ✗ | ✗ | ✗ |
| S-32 Designations | ✓ | ✗ | ✗ | ✗ |
| S-33 Shifts | ✓ | ✓ | ✗ | ✗ |
| S-34 Role management | ✓* | ✗ | ✗ | ✗ |
| S-35 IP whitelist | ✓ | ✗ | ✗ | ✓ |
| S-36 Geofence | ✓ | ✗ | ✗ | ✓ |
| S-37 Notification settings | ✓ | ✗ | ✗ | ✗ |
| S-38 Onboarding checklist | ✓ | ✗ | ✗ | ✗ |
| S-39 App Configuration | ✓ | ✗ | ✗ | ✗ |

*Owner with System Admin privilege only.

---

## Navigation Structure Per Role

### Owner sidebar
```
Dashboard
Employees  →  List | Add New | Import
Attendance →  Team View | Reports
Leave      →  Approvals | Team Calendar | Policies | Holidays
Reports    →  Attendance | Leave | Headcount | Regularization | Heatmap
Settings   →  Departments | Designations | Shifts | Roles | IP Whitelist | Geofence | Notifications | Onboarding | App Config
```

### HR sidebar
```
Dashboard
Employees  →  List
Attendance →  Team View
Leave      →  Approvals | Team Calendar | Holidays
Reports    →  Attendance Summary | Leave Balance
Settings   →  Shifts
```

### Employee sidebar
```
Dashboard  (check-in/out + Log WFH button prominent)
My Profile
My Attendance
My Leave   →  Apply | History | Balances | Comp-Off
My Reports
```

### System Admin sidebar
```
Dashboard
Employees  (read-only)
Attendance (read-only)
Leave      (read-only)
Reports    →  Headcount
Settings   →  IP Whitelist | Geofence
Audit Logs
```
