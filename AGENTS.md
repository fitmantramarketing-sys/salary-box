# HR Tool — Agent Context File

## What this is
Internal HR webapp for a 10–20 employee company. Covers employee management,
attendance, and leave. Stack: React 18 + TypeScript + Tailwind CSS + shadcn/ui,
backed entirely by Supabase (Postgres + RLS, Auth, Storage, Edge Functions).
There is no separate backend server.

This file is a quick-start map for any AI agent picking up work in this repo.
It does not replace the project docs — it points to them.

- **Full conventions, folder structure, non-negotiable rules:** `CLAUDE.md`
- **DB schema (24 tables):** `docs/DATABASE_SCHEMA.md`
- **Validation logic, formulas, BR-XXX rules:** `docs/BUSINESS_RULES.md`
- **RLS policies, role definitions:** `docs/ROLE_RULES.md`
- **Routes and screens per role:** `docs/SCREEN_INVENTORY.md`
- **Edge Function request/response contracts:** `docs/EDGE_FUNCTIONS.md`
- **Architecture / state management / type strategy:** `docs/ARCHITECTURE.md`

If a rule isn't in your current context, read the relevant doc above before
inventing an answer.

## Current status — UPDATE THIS EVERY SESSION
Last updated: 2026-06-27
Active branch: experiment-new-agent
Current session: Resend transactional email configured + 17 EFs updated with email
notifications alongside in-app notifications. Attendance business rules overhaul also
completed — grace period removed, half-day at 10:21, early checkout reason + approval
flow, overtime removed entirely, auto-checkout shift-aware (end+buffer), no-checkout → absent.

### M2 — Complete Feature Set
- **M2-1 CSV Export:** "Download CSV" button on EmployeesPage header
- **M2-2 Onboarding Checklist CRUD:** `SettingsOnboardingPage.tsx`
- **M2-3 App Configuration:** `AppConfigPage.tsx`
- **M2-4 Add Employee Steps 3 & 4:** 4-step NewEmployeePage creation flow
- **M2-5 Bank Details Edit:** Owner-only edit dialog
- **M2-6 Advanced Filters:** Department/employment status dropdowns
- **M2-7 to M2-9:** 3 cron functions (access-revocation, exit-date-alert, future-joiner-activation)
- **Activity Timeline:** `EmployeeActivityTab.tsx`
- **Org Chart:** `/org-chart` page with recursive tree
- **Profile Edit Requests:** Full self-service flow with approve/reject

### M3 Phase 1 — Attendance Backend
- **5 shared utilities:** `geo.ts`, `ip.ts`, `holiday.ts`, `attendance.ts`, `shift.ts`
- **10 Edge Functions deployed:** check-in, check-out, log-wfh, auto-checkout,
  compute-attendance-status, manual-attendance, submit-regularization,
  review-regularization, late-mark-deduction, incomplete-attendance-reminder
- **`_shared/attendance.ts`** rewritten: no overtime, `computeTotalHours` accepts
  `capAt`, `computeStatus` half-day = check-in ≥20min after shift start,
  no-checkout → absent

### M3 Phase 2 — Regularization & Notifications
- `submit-regularization`, `review-regularization` Edge Functions
- `late-mark-deduction`, `incomplete-attendance-reminder` cron functions

### M3 Phase 3 — Employee Self-Service Frontend
- `CheckInOutCard`, `AttendanceSummaryCards`, `AttendanceCalendar`
- `AttendancePage`, `DashboardPage`, `RegularizationPage` wired

### M3 Phase 4 — Admin Attendance Frontend
- `TeamAttendancePage` (grid + CSV export)
- `EmployeeAttendanceDrillDownPage` (manual entry dialog)
- `ShiftsPage` (CRUD + dept/employee assignments)
- `RegularizationPage` admin queue (tabs: Pending Reviews + My Requests)
- Mobile responsive sidebar with hamburger toggle

### M3 Phase 5 — IP Whitelist, Geofence & Geolocation Wiring
- **IPWhitelistPage** (`/settings/ip-whitelist`): CRUD for CIDR ranges (label, cidr, is_active)
- **GeofencePage** (`/settings/geofence`): CRUD for geofence locations with
  Leaflet map — click to place center, drag to adjust, radius slider with live
  circle overlay (`GeofenceMapPicker` component)
- **Geolocation**: `CheckInOutCard` and `DashboardPage` now call
  `navigator.geolocation.getCurrentPosition()` before check-in/check-out,
  passing real lat/lng to Edge Functions

### M4 — Leave Module (completed this session)
**16 Edge Functions deployed:**
| Function | Role | Key logic |
|---|---|---|
| `submit-leave` | owner/hr/employee | BR-LVE-01 to 07, 13, 15-17: gender, notice, working days, overlap, balance, attachment, escalation |
| `review-leave` | owner/hr | Approve → balance taken += wd, attendance on_leave; Reject → reverse pending |
| `cancel-leave` | owner/hr/employee | Pending only, reverses pending hold |
| `request-leave-cancellation` | owner/hr/employee | Approved future leaves only, notifies admins |
| `confirm-leave-cancellation` | owner/hr | Confirm → cancel + reverse taken/attendance (future dates); Reject → reset flag |
| `submit-comp-off` | owner/hr/employee | Validates holiday/weekly-off |
| `review-comp-off` | owner/hr | Approve → expiry date + balance accrual |
| `opt-in-holiday` | owner/hr/employee | Validates optional + future + yearly limit |
| `opt-out-holiday` | owner/hr/employee | Checks no approved leave on date |
| `monthly-leave-accrual` | cron | Credits accrual_days/12 per leave type |
| `year-end-leave-rollover` | cron | Carry-forward + new year rows |
| `leave-sla-escalation` | cron | Escalates stale pending leaves to Owner |
| `carry-forward-expiry-alert` | cron | 30/7 day alerts |
| `carry-forward-lapse` | cron | Lapses expired carry-forward |
| `comp-off-expiry-alert` | cron | 7 day alert |
| `comp-off-lapse` | cron | Lapses expired comp-off balances |

**12 frontend components built (`src/features/leave/components/`):**
| Component | What it does |
|---|---|
| `ApplyLeaveForm` | Full form with leave type selector, date range, half-day toggle, balance display, insufficient balance warning |
| `LeaveBalanceSummary` | Color-coded per-type balance cards (green/yellow/red) |
| `LeaveApplicationList` | Clickable table/card list with status badges |
| `LeaveApplicationDetail` | Full detail with cancel/request-cancellation/ReviewActions |
| `ReviewActions` | Approve/Reject button pair with comment dialog |
| `PendingLeaveQueue` | Admin queue — tabs: pending leaves + cancellation requests |
| `PendingCancellationQueue` | Admin confirm/reject cancellations |
| `TeamLeaveCalendar` | Month grid: rows=employees, cells=colour-coded leaves |
| `CompOffForm` | Worked date + hours form |
| `LeaveTypeList` + `LeaveTypeForm` | CRUD for leave types (owner only) |
| `HolidayList` | Holiday calendar, opt-in/out for optional holidays, CRUD dialog |
| `LeaveBalanceReport` | Report grid: employees × leave types |

**8 pages wired (from TODO stubs):**
`LeaveDashboardPage`, `ApplyLeavePage`, `LeaveApplicationDetailPage`,
`TeamLeavePage` (tabs: queue + calendar), `LeaveTypesPage`, `CompOffPage`,
`HolidayCalendarPage`, `ReportsLeavePage`

**Feature layer updates:**
- `api.ts` — added `fetchCancellationRequests`, `fetchCompOffRequests`, `fetchHolidays`, `fetchMyOptionalHolidays`
- `hooks.ts` — added 5 corresponding hooks
- `mutations.ts` — added `useSubmitCompOff`, `useReviewCompOff`, `useOptInHoliday`, `useOptOutHoliday`
- `types/index.ts` — added `Holiday`, `CompOffRequest` exports; made `employee` optional in `LeaveApplicationWithRelations`

### Dark Mode / Theme Toggle (this session)
- **`src/main.tsx`**: Wrapped app with `<ThemeProvider>` from `next-themes` (already installed)
- **`src/components/layout/Header.tsx`**: Replaced direct sign-out button with a
  dropdown menu panel — shows avatar initials + employee info, Light/Dark/System
  theme options (with active highlight), and Sign Out with LogOut icon

### Bugs Fixed
- **working-days.ts + holiday.ts**: Removed `.eq('is_active', true)` on `holidays` table (table has no `is_active` column)
- **LeaveTypeForm**: Fixed blank screen on dialog open — Radix Select crashes with empty string `""` values; changed default to `"all"`, mapped back to `null` on save
- **Join syntax**: Supabase FK joins throughout
- **Geolocation wiring**: CheckInOutCard and Dashboard now pass real coords

### This session — Geofence Enforcement & M4 Polish
- **Geofence hard-block**: `check-in` EF now rejects non-owner users who are outside any active geofence zone (403 FORBIDDEN). Location permission denial/timeout also blocked for non-owner.
- **HolidayList bugs fixed**: Empty state now shows "Add Holiday" button for admin/HR; three early returns consolidated so dialogs (Add/Edit/Delete) are always in the DOM.
- **opt-in-holiday fixed**: Insert was missing `year` column causing NOT NULL constraint violation.
- **`sync-holiday-attendance` EF created**: When holidays are added/edited/deleted, attendance records for affected dates are synced (absent→holiday, holiday removed→incomplete).
- **TeamAttendancePage**: Now fetches `holidays` table and shows holiday-colored cells for future dates even without attendance records.
- **AttendanceCalendar**: Shows holiday-colored cells for future holiday dates.
- **All 16 M4 Edge Functions deployed**: Previously only implemented locally, now fully deployed.
- **upload-leave-attachment EF**: New function for uploading leave attachments to storage, returns `storage_path`.
- **ApplyLeaveForm**: Added file upload with paperclip button, file picker, upload spinner, filename display, clear button.
- **submit-leave redeployed**: Was missing from deployed list despite deploy command reporting success.
- **compute-attendance-status + incomplete-attendance-reminder redeployed**: Both also missing.

### This session — `update-app-config` EF & `uuid_generate_v5` fix
- **`update-app-config` EF kept failing** with `INTERNAL_ERROR` / "Failed to update configuration"
- **Root cause found**: The `log_changes` trigger function is SECURITY DEFINER with `search_path=public`, but `uuid_generate_v5()` (from uuid-ossp extension) lives in the `extensions` schema → every UPDATE/DELETE on `app_config` crashed with `42883: function uuid_generate_v5(uuid, text) does not exist`
- **Fix**: Created `public.uuid_generate_v5(namespace uuid, name text)` wrapper delegating to `extensions.uuid_generate_v5()`. Applied via migration `0014_fix_uuid_ossp_search_path.sql` (applied via Management API SQL query)
- **Result**: `update-app-config` EF now works end-to-end — verified with valid input (`leave_sla_business_days` → `5` returned `{key, value}`) and invalid key returned `VALIDATION_ERROR`

### M5 — Reports & Polish (completed this session)
**5 reports pages implemented:**
| Page | Route | Key features |
|---|---|---|
| `ReportsAttendancePage` | `/reports/attendance` | Role-aware: Owner/HR see monthly summary table with dept filter + CSV export; Employee sees self-attendance day-by-day table with summary cards |
| `ReportsHeadcountPage` | `/reports/headcount` | Filters for department, status (active/probation/resigned/terminated), type (full-time/part-time/contractor/intern) + summary cards + CSV export |
| `ReportsRegularizationPage` | `/reports/regularization` | Date range, department, and status filters; table with employee, date (via attendance_records join), reason, reviewer; CSV export |
| `ReportsHeatmapPage` | `/reports/heatmap` | Monthly grid: departments × days, color-coded by attendance % (green→red); month navigation; avg % column |
| `SettingsNotificationsPage` | `/settings/notifications` | Editable list of all 6 `app_config` keys with type-specific inputs (boolean dropdown, text, time), saves via `update-app-config` EF |

**Feature layer (`src/features/reports/`):**
- `api.ts` — 6 query functions: `fetchAttendanceReport`, `fetchHeatmapData`, `fetchHeadcountReport`, `fetchRegularizationLog`, `fetchSelfAttendance`, `fetchDepartments` — all with typed return types
- `hooks.ts` — React Query wrappers for all API functions
- `utils.ts` — shared `downloadCSV(headers, rows, filename)` utility

### This session — Cron Scheduling & Weekly Off UI Fix
- **All 15 cron functions scheduled** via `pg_cron` + `pg_net` (enabled extensions, stored
  project URL + anon key in Vault). Previously only deployed but unscheduled — now run
  daily at appropriate IST hours via Management API SQL.
- **Migration `0015_schedule_cron_functions.sql`** saved for version control.
- **Weekly off day UI fix**: `AttendanceCalendar`, `TeamAttendancePage`, and
  `fetchSelfAttendance` (ReportsAttendancePage) now fetch the default shift's
  `weekly_off_days` and mark Sundays as `weekly_off` (gray) instead of hiding them
  or showing as absent. Applied to employee calendar, team grid, and self-report.

### This session — Resend Transactional Email Configuration
- **RESEND_API_KEY stored** in Supabase project secrets — `sendEmail` now works across all EFs
- **`_shared/email.ts`** — default `from` address updated to `noreply@hr.fitmantra.co.in`
- **Password reset**: Configure Resend SMTP in Supabase Dashboard → Auth → Settings → SMTP (host: `smtp.resend.com`, port: `587`, credentials = API key)
- **17 EFs updated + deployed** with transactional email alongside in-app notifications:

| EF | Who gets emailed | Trigger |
|---|---|---|
| `future-joiner-activation` | Employee | Welcome on activation day |
| `create-employee` | Employee | Welcome with temp password (was already built) |
| `review-leave` | Employee | Approve/reject notification |
| `review-regularization` | Employee | Approve/reject notification |
| `review-comp-off` | Employee | Approve/reject notification |
| `confirm-leave-cancellation` | Employee | Cancellation confirmed/rejected |
| `auto-checkout` | Employee | Auto-checkout with regularization prompt |
| `incomplete-attendance-reminder` | Employee | Yesterday's attendance incomplete |
| `late-mark-deduction` | Employee | 0.5 day deducted from leave balance |
| `submit-regularization` | HR/Owner | New regularization request |
| `submit-leave` | HR/Owner | New leave application |
| `request-leave-cancellation` | HR/Owner | Cancellation requested |
| `carry-forward-expiry-alert` | Employee | 30/7 day expiry warning |
| `comp-off-expiry-alert` | Employee | 7 day expiry warning |
| `leave-sla-escalation` | Owner | SLA breached on pending leave |
| `exit-date-alert` | HR/Owner/Admin | Exit date in 7 days |
| `probation-end-alert` | Owner | Probation ending in 14 days |
| `access-revocation` | HR/Owner | Employee access revoked |

### This session — Attendance Business Rules Overhaul
- **Grace period removed**: Any check-in after 10:00 is late (was 20min grace).
- **Half-day deadline**: Check-in ≥10:21 → `half_day` status (was based on hours worked).
- **Early checkout**: Check-out before shift end requires `early_checkout_reason` (400 if missing).
  HR/Owner can approve (keep status) or reject (set `absent`).
- **Overtime removed entirely**: `computeOvertime`/`computeOvertimeFromShift` deleted.
  `total_hours` capped at shift end via `capAt` parameter in `computeTotalHours`.
- **Auto-checkout shift-aware**: Resolves each employee's shift, sets check-out at
  end time + buffer (30min default from `app_config` key `auto_checkout_buffer_minutes`).
  Status = `absent` (not `incomplete`).
- **No checkout → absent**: `computeStatus` returns `absent` when `check_out_time` is null
  (was `incomplete`). Still regularizable.
- **Migration `0016_early_checkout.sql`**: Adds `early_checkout_reason` (text) and
  `early_checkout_status` (text, check: pending/approved/rejected) to `attendance_records`.
- **Early Checkouts tab**: New tab in `RegularizationPage` — lists pending early checkouts
  with approve/reject buttons. Approve keeps status; reject sets `absent`.
- **Late count warning**: `CheckInOutCard` shows warning banner when approaching
  late threshold (`late_count_this_month` / `late_threshold`).
- **6 EFs redeployed**: `check-in`, `check-out`, `auto-checkout`, `compute-attendance-status`,
  `manual-attendance`, `review-regularization` — all with updated business rules.
- **Typecheck + lint clean**: `database.types.ts` regenerated via `supabase gen types`.

### Remaining items
1. Fix migration naming conflict (`0010_*` duplication) — run `supabase migration repair`
2. Re-seed `departments`, `designations`, `shifts` reference data via UI
3. Additional pages: absenteeism tab on ReportsAttendancePage (S-24),
   employee leave self-view on ReportsLeavePage (S-30)

### SMTP Configuration (still needed)
- Configure Resend SMTP in Supabase Dashboard → Authentication → Settings → SMTP for password reset emails:
  - Host: `smtp.resend.com`, Port: `587`, Username/Password: `RESEND_API_KEY`, Sender: `HR Tool <noreply@hr.fitmantra.co.in>`

### Edge Functions Deployed (cumulative)
- M1/M2: `add-lifecycle-event`, `upload-document`, `generate-presigned-url`,
  `bulk-import-employees`, `update-employee`, `create-employee`,
  `access-revocation`, `exit-date-alert`, `future-joiner-activation`,
  `review-profile-edit`, `update-app-config`, `probation-end-alert`
- **M3:** `check-in`, `check-out`, `log-wfh`, `auto-checkout`,
  `compute-attendance-status`, `manual-attendance`,
  `submit-regularization`, `review-regularization`,
  `late-mark-deduction`, `incomplete-attendance-reminder`
- **M4:** `submit-leave`, `review-leave`, `cancel-leave`,
  `request-leave-cancellation`, `confirm-leave-cancellation`,
  `submit-comp-off`, `review-comp-off`, `opt-in-holiday`, `opt-out-holiday`,
  `upload-leave-attachment`,
  `monthly-leave-accrual`, `year-end-leave-rollover`, `leave-sla-escalation`,
  `carry-forward-expiry-alert`, `carry-forward-lapse`, `comp-off-expiry-alert`,
  `comp-off-lapse`, `sync-holiday-attendance`

### Known issues
- `origin/main` on GitHub reverted to pre-scaffold state — local branches correct
- Auth setting `mailer_allow_unverified_email_sign_ins = true` required
- Migration naming conflict: two `0010_*` files — run `supabase migration repair`
- All `departments`, `designations`, `shifts` rows hard deleted — re-seed via UI
- Resend SMTP still needs to be configured in Supabase Dashboard Auth settings for password reset emails

## Supabase project access (for agents)
This repo has a project-scoped Supabase MCP server configured in `.mcp.json`,
authenticated via a personal access token (`SUPABASE_ACCESS_TOKEN`, set as a
local Windows user environment variable — never committed). When connected,
the `mcp__supabase__*` tools give direct access to project
`hqiggiqwyxjiltltvoay` (the HR Tool project):

- `list_tables`, `list_migrations`, `list_extensions`, `get_advisors`,
  `get_logs`, `get_project_url` — inspection, always safe to call.
- `apply_migration` — applies SQL directly to this remote project and records
  it in the project's migration history. Workflow: write the SQL file to
  `supabase/migrations/<NNNN>_<name>.sql` first (for version control), then
  call `apply_migration` with the same name/content so local files and the
  remote project stay in sync.
- `execute_sql` — ad-hoc queries for inspection/debugging only. Don't use it
  for schema changes that should be migrations.
- `generate_typescript_types` — regenerate `src/types/database.types.ts`
  after schema changes. (Use `npx supabase gen types typescript --project-id <id> > src/types/database.types.ts`
  locally since CLI isn't installed; or use `npm run types:gen`.)

If the MCP server isn't connected in a session, say so and fall back to
writing the migration SQL for the user to apply.

## Roles (4 only)
`owner`, `hr`, `employee`, `system_admin` — see `docs/ROLE_RULES.md` for the
full RLS policy matrix per table. RLS is enforced at the database level; never
replicate access control only in the frontend.

## File structure
```
src/
  components/ui/        ← shadcn/ui primitives only
  components/layout/    ← Sidebar, Header, RoleGuard
  pages/                ← thin route-level components, import from features/
  features/<domain>/    ← components/, hooks/, schemas/, utils/, index.ts
  hooks/                ← useAuth, useRole
  lib/                  ← supabase.ts, queryClient.ts
  types/                ← database.types.ts (generated, do not edit) + index.ts
supabase/
  migrations/           ← numbered SQL migrations
  seed.sql
  functions/
    _shared/            ← supabase.ts, auth.ts, response.ts, email.ts,
                           notify.ts, audit.ts, shift.ts, working-days.ts,
                           geo.ts, ip.ts, holiday.ts, attendance.ts
    <function-name>/index.ts
```

## Critical rules
- RLS is always on. Never disable it to make something work — fix the policy.
- Edge Functions are the source of truth for server timestamps
  (`check_in_time`, `check_out_time`, `applied_at`, etc.). Never send these
  from the client.
- No hard deletes — set `is_active = false` and filter on it.
- `account_number_encrypted` is never returned to the frontend.
- Business rules live in Edge Functions or DB constraints, never only in React.
- Presigned URLs only for document access — never expose raw storage paths.
- Never install `axios` — use `@supabase/supabase-js` or native `fetch`.
- Never create an Express/FastAPI/Node server — Supabase is the entire backend.
- Never use `localStorage` for auth — Supabase Auth manages sessions.
- Regenerate DB types after every migration: `npm run types:gen`.

## Branch rules
- `main` — protected, production only.
- `dev` — integration branch, should always build and pass typecheck/lint.
- `feature/<module>` — one branch per milestone/module, branched from `dev`,
  merged back into `dev` (e.g. `feature/auth-rbac`, `feature/employee-module`,
  `feature/attendance-module`, `feature/leave-module`, `feature/reports-polish`).
- `fix/<short-description>` — short-lived, branched from `dev`.
- `dev` → `main` only at milestone completion.

## What NOT to do
- Don't write a custom backend server.
- Don't skip or weaken RLS policies.
- Don't use any auth mechanism other than Supabase Auth.
- Don't mix work from two milestones/modules in one branch.
- Don't enforce business rules only in React (see CLAUDE.md → Non-Negotiable Rules).
- Don't commit directly to `main` or `dev`.
