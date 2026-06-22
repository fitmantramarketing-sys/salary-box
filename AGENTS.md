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
Last updated: 2026-06-22
Active branch: experiment-new-agent
Current session: M4 completed — all Edge Functions deployed and working.
Leave submits with attachments, geofence hard-blocks non-owners, holiday sync
and calendar display fixed. Leave approvals queue not showing (bug deferred).
M1+M2+M3+M4 code complete. M5 not started.

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
- **4 shared utilities:** `geo.ts`, `ip.ts`, `holiday.ts`, `attendance.ts`
- **10 Edge Functions deployed:** check-in, check-out, log-wfh, auto-checkout,
  compute-attendance-status, manual-attendance, submit-regularization,
  review-regularization, late-mark-deduction, incomplete-attendance-reminder

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

### Bugs Fixed
- **working-days.ts + holiday.ts**: Removed `.eq('is_active', true)` on `holidays` table (table has no `is_active` column)
- **LeaveTypeForm**: Fixed blank screen on dialog open — Radix Select crashes with empty string `""` values; changed default to `"all"`, mapped back to `null` on save
- **Join syntax**: Supabase FK joins throughout
- **Geolocation wiring**: CheckInOutCard and Dashboard now pass real coords

### Edge Functions Deployed (cumulative)
- M1/M2: `add-lifecycle-event`, `upload-document`, `generate-presigned-url`,
  `bulk-import-employees`, `update-employee`, `create-employee`,
  `access-revocation`, `exit-date-alert`, `future-joiner-activation`,
  `review-profile-edit`
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
- RESEND_API_KEY not configured → welcome email silently fails
- Auth setting `mailer_allow_unverified_email_sign_ins = true` required
- Migration naming conflict: two `0010_*` files — run `supabase migration repair`
- **17 cron functions not scheduled** in Supabase Dashboard:
  10 M3 crons + 7 M4 leave crons — all deployed but schedules need configuration
- All `departments`, `designations`, `shifts` rows hard deleted — re-seed via UI
- **Leave approvals queue not showing submitted leaves** — PendingLeaveQueue fetches
  `leave_applications` with `.eq('status', 'pending')` and joins `employee` relation.
  RLS is correct (owner/hr see all rows). Likely a join syntax issue or the query
  silently fails. Investigate `fetchPendingLeaveApplications` in `api.ts`.

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
  after schema changes.

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
