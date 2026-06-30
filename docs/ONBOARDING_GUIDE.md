# Employee Onboarding Guide

**Prerequisites:** Owner logged in at https://salary-box-sigma.vercel.app

---

## Phase 1 — System Configuration

| # | Route | Action | Role |
|---|---|---|---|
| 1 | `/settings/app-config` | Review all key-value pairs. Set: `auto_checkout_buffer_minutes`, `regularization_window_days`, `leave_sla_business_days`, `late_threshold`, `optional_holiday_limit_per_year` | Owner |
| 2 | `/settings/departments` | Create departments (click "Add Department"): Engineering, HR, Sales, Marketing, Finance, Operations, etc. Supports hierarchy (parent → child, max 3 levels) | Owner |
| 3 | `/settings/designations` | Create designations grouped by department (click "Add Designation"): e.g. SDE-I, SDE-II, Tech Lead, HR Executive, HR Manager, Sales Executive | Owner |
| 4 | `/settings/shifts` | Create a default shift: name, start/end time, weekly off days (e.g. Sun/Mon), break duration, late mark threshold. Then assign it to all departments via "Department Assignments" section | Owner/HR |
| 5 | `/settings/leave-types` | Create leave types: Annual Leave, Sick Leave, Casual Leave, Comp Off, etc. Configure accrual type (monthly/yearly/manual), accrual days, max carry-forward, max consecutive days, min notice, gender restrictions, LWP toggle | Owner |
| 6 | `/settings/holidays` | Add public holidays for 2026 (date + name). Mark optional holidays separately (employees can opt in/out) | Owner/HR |
| 7 | `/settings/ip-whitelist` | (Optional) Add office CIDR ranges if attendance restricted to office network | Owner/SA |
| 8 | `/settings/geofence` | (Optional) Add office geofence location (click on map, drag marker, set radius) | Owner/SA |
| 9 | `/settings/onboarding-checklist` | (Optional) Create onboarding checklist template items for new hires | Owner |
| 10 | `/settings/notifications` | Review notification-related config values | Owner |

---

## Phase 2 — Create HR Employee

1. Navigate to **Employees → Add Employee** (4-step wizard)
2. **Step 1 — Personal Info:** Name, email, phone, DOB, gender, personal email
3. **Step 2 — Job Details:** Select department + designation from Phase 1, employment type (Full-Time/Part-Time/Contractor/Intern), date of joining, reporting manager (leave blank if none)
4. **Step 3 — Documents:** (Optional) Upload ID proof, offer letter, etc.
5. **Step 4 — Bank Details:** (Optional) Add bank account info
6. Submit → HR receives welcome email with temp password + login link
7. Ask HR to log in and change password
8. Verify role at `/settings/roles` — should show `hr`

---

## Phase 3 — Create Remaining Employees

### Option A — One-by-one via UI (recommended for 10–20)

Repeat Phase 2 steps for each employee. Suggested order:
1. Department heads / managers
2. Individual contributors

### Option B — Bulk import (if CSV ready)

Check if a bulk-import button or route exists. The `bulk-import-employees` Edge Function is deployed; if no UI exists, ask to build one.

---

## Phase 4 — Leave Balances

| # | Route | Action |
|---|---|---|
| 1 | `/settings/leave-balances` | Table: rows = employees, columns = leave types. **Click** a cell to edit Opening/Adjusted values |
| 2 | Set opening balances | e.g. Annual Leave = 21, Sick Leave = 12, Casual Leave = 6 per employee |
| 3 | (Optional) **Year-End Reset** button | Carries forward remaining balance into next year. Only needed if starting mid-year |

---

## Phase 5 — Verification

| What to test | Steps |
|---|---|
| **Attendance** | Login as employee → Check In → Check Out → Verify record in `/attendance/team` and `/reports/attendance` |
| **Leave** | Apply leave as employee → Approve/review as HR/Owner → Verify balance deduction in `/settings/leave-balances` |
| **Notifications** | Check email inbox for: welcome email, leave approval/rejection, attendance reminders |
| **Reports** | View `/reports/attendance`, `/reports/headcount`, `/reports/heatmap`, `/reports/regularization` |
| **Mobile** | Open app on phone — sidebar should collapse with hamburger toggle |

---

## Reference

- **Owner email:** fitmantrabyamanatkagzi@gmail.com
- **App URL:** https://salary-box-sigma.vercel.app
- **Change owner email:** Update `auth.users.email` + `public.employees.email` (ask agent when ready)
