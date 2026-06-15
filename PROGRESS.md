# Progress Log

## Current State
Date: 2026-06-15
Active branch: experiment-new-agent
Milestone: M1 — Foundation (COMPLETE — all 7 phases done)
Next milestone: M2 — Employee Module (document vault, bulk import, lifecycle events)

## Completed
- All spec/context docs in `docs/` (DATABASE_SCHEMA, BUSINESS_RULES,
  ROLE_RULES, SCREEN_INVENTORY, EDGE_FUNCTIONS, ARCHITECTURE) plus `CLAUDE.md`
- Full repo scaffold: Vite + React 18 + TypeScript + Tailwind + shadcn/ui
- Route tree, layout shell, role guard component, Zustand auth store
- Feature-folder scaffolds (components/hooks/schemas/utils) for auth,
  employees, attendance, leave, reports, settings
- `supabase/` project config, `seed.sql`, `_shared/` Edge Function utilities
- Stub `index.ts` for all 36 Edge Functions (21 client-callable + 15 cron)
  with TODOs referencing `docs/EDGE_FUNCTIONS.md`
- `.env.example` and `.gitignore` updated for Supabase CLI artifacts
- Removed vestigial `apps/` monorepo placeholders
- `npm install`, `npm run typecheck`, `npm run lint`, `npm run dev` all
  verified clean
- `main` / `dev` / `feature/auth-rbac` branch structure created;
  `main` re-pointed to track `origin/main`
- AGENTS.md, PROGRESS.md, CONVENTIONS.md, ENV.md added at repo root
- Supabase MCP server connected: project-scoped `.mcp.json` running
  `@supabase/mcp-server-supabase` via npx, authenticated with a personal
  access token (`SUPABASE_ACCESS_TOKEN`, local Windows user env var, never
  committed). Verified live access to project `hqiggiqwyxjiltltvoay`
  (HR Tool) — database currently empty, ready for the initial migration.
- Initial SQL migration covering all 24 tables (`docs/DATABASE_SCHEMA.md`) and
  RLS policies per table per role (`docs/ROLE_RULES.md`), applied to project
  `hqiggiqwyxjiltltvoay` as `supabase/migrations/0001`–`0008`:
  - `0001_enums` — all 10 enum types.
  - `0002_core` — departments, designations, employees;
    `get_my_role()` / `get_my_employee_id()` helpers; `set_updated_at()`
    trigger; `enforce_employee_update()` field-level trigger; RLS for all 3.
  - `0003_employee_detail` — employee_documents, employee_bank_details,
    employee_lifecycle_events, onboarding_checklist_templates,
    employee_onboarding_progress + RLS + `enforce_document_softdelete()`.
  - `0004_shift_attendance` — shifts, department_shifts,
    employee_shift_overrides, attendance_records,
    attendance_regularization_requests + RLS + `enforce_attendance_timestamps()`.
  - `0005_leave` — leave_types, leave_balances, leave_applications, holidays,
    comp_off_requests, employee_optional_holidays + RLS +
    `enforce_leave_application_update()`.
  - `0006_admin` — ip_whitelist, geofence_config, notifications, audit_logs,
    app_config + RLS + seeded `app_config` defaults (6 keys, matches `seed.sql`).
  - `0007_audit_triggers` — `log_changes()` SECURITY DEFINER trigger, attached
    to the 21 tables per DATABASE_SCHEMA.md "Trigger Requirements".
  - `0008_security_hardening` — added `set search_path = public` to the 5
    plpgsql trigger functions from 0002–0005 (fixes
    `function_search_path_mutable` advisor WARNs); rewrote `employees_select`,
    `employees_update`, `department_shifts_select` to use
    `(select auth.uid())` (fixes `auth_rls_initplan` advisor WARNs). No
    behavioral changes.
  - Verified via `get_advisors`: no RLS-disabled or missing-required-index
    findings; remaining advisories are either intentional
    (`get_my_role`/`get_my_employee_id` RPC exposure, `log_changes`/
    `rls_auto_enable` trigger functions) or out-of-spec INFO items
    (unindexed FKs not listed in DATABASE_SCHEMA.md, unused indexes on
    currently-empty tables).
  - RLS spot-check: `anon` role sees 0 rows of `app_config` (6 rows visible to
    a privileged connection); `get_my_role()`/`get_my_employee_id()` return
    `null` for `anon`.
  - Regenerated `src/types/database.types.ts` via
    `generate_typescript_types` (includes `Relationships: [...]` per table).
    Fixed 3 resulting `npm run typecheck` mismatches against placeholder
    feature code: `getEmploymentStatusLabel` (added missing
    `employment_status` enum values), `fetchHolidays` (removed
    non-existent `holidays.is_active` filter), `useCreateDepartment` /
    `departmentSchema` (removed non-existent `departments.description` field,
    added real `parent_id`). `npm run typecheck` passes clean.
- **2026-06-15 — M1 Phase 1: Bootstrap + Prerequisites**
  - Migration `0009_bootstrap_owner` applied via MCP `apply_migration`:
    created Owner auth.users account (fitmantrabyamanatkagzi@gmail.com,
    password hashed via crypt/gen_salt/bf) + linked employees row
    (id=83900680-e1d4-4c2e-93ed-e476e39b264d, auth_id=dfad9a65-72d3-47ee-
    a63e-f2acde3837fa, employee_code=EMP-2026-0001, role=owner,
    is_first_login=true). DO block with idempotency guard + auth.identities
    row for email provider.
  - Initialized shadcn/ui: `npx shadcn@latest init --template vite --yes`
    → components.json, tailwind.config.ts updated, vite.config.ts path
    aliases verified. Installed 17 UI components via `npx shadcn@latest add`:
    Button, Input, Label, Card, Form, Toast, Toaster, Separator, Badge,
    Table, DropdownMenu, Sheet, ScrollArea, Avatar, Dialog, Sonner, Chart.
  - Fixed toaster.tsx broken import: `@/components/hooks/use-toast` →
    `@/hooks/use-toast`.
- **2026-06-15 — M1 Phase 2: Auth Flow**
  - `src/features/auth/components/LoginForm.tsx`: React Hook Form + Zod
    (loginSchema), supabase.auth.signInWithPassword, password visibility
    toggle, generic error messages per S-01 spec, loading spinner.
  - `src/features/auth/components/SetPasswordForm.tsx`: password strength
    indicator (4 rules + visual bar), supabase.auth.updateUser, updates
    employees.is_first_login=false, updates local auth store.
  - `src/features/auth/components/ForgotPasswordForm.tsx`: supabase.auth
    .resetPasswordForEmail, always shows success (security best practice),
    success state with "Check your email" UI.
  - `src/pages/LoginPage.tsx`: premium glassmorphism card, gradient
    background, decorative blur elements, forgot-password link.
  - `src/pages/SetPasswordPage.tsx`: session guards (redirect if not
    authed or already set), personalized welcome message.
  - `src/pages/ForgotPasswordPage.tsx`: matching premium design.
  - `src/App.tsx` rewritten: proper onAuthStateChange handling for
    SIGNED_IN/TOKEN_REFRESHED/SIGNED_OUT/PASSWORD_RECOVERY, hydrateEmployee
    helper, first-login auto-redirect to /set-password, /forgot-password
    route added, Sonner toast provider.
  - `src/components/layout/RoleGuard.tsx`: added RequireFirstPasswordSet
    guard (redirects is_first_login users to /set-password), wraps AppLayout.
  - `src/features/auth/index.ts`: barrel exports for all 3 form components.
  - Fixed pre-existing build issue: tsconfig.node.json had composite +
    allowImportingTsExtensions conflict; removed composite/references,
    changed build script from `tsc -b` to `tsc --noEmit`.
  - `npm run typecheck` passes clean. `npm run build` passes clean
    (592 KB JS bundle, 30 KB CSS).
- **2026-06-15 — M1 Phase 3: Sidebar Navigation**
  - `src/components/layout/Sidebar.tsx` fully rewritten with role-aware
    navigation groups per SCREEN_INVENTORY.md. Owner sees full nav tree
    (Employees, Attendance, Leave, Reports, Settings with sub-items); HR
    sees filtered view (Employees, Attendance, Leave, Reports, Shifts);
    Employee sees Dashboard, My Profile, My Attendance, My Leave, My
    Reports; System Admin sees Dashboard, read-only Employees/Attendance/
    Leave, Headcount Reports, IP Whitelist/Geofence Settings.
  - Collapsible nav groups with expand/collapse chevrons.
- **2026-06-15 — M1 Phase 4: Department CRUD**
  - `src/pages/DepartmentsPage.tsx`: tree view rendering with recursive
    DepartmentTree component. Add root/sub-department via Dialog form,
    rename inline, soft-delete (deactivate). Max 3-level nesting enforced
    (L0→L1→L2). Owner-only access via RequireRole.
- **2026-06-15 — M1 Phase 5: Designation CRUD**
  - `src/pages/DesignationsPage.tsx`: grouped by department in card grid.
    Add/edit via Dialog with department selector, soft-delete. Owner-only.
- **2026-06-15 — M1 Phase 6: Employee CRUD + Edge Function**
  - `supabase/functions/create-employee/index.ts` fully implemented:
    1. Email uniqueness check → DUPLICATE (409)
    2. Auto employee_code (EMP-YYYY-NNNN) with year-prefixed sequential count
    3. employment_status: future_joiner if join_date > today, else active
    4. Insert employees row
    5. Supabase Auth admin.createUser with temp password, email_confirm=true
    6. Link auth_id back to employee row
    7. Welcome email via Resend (best-effort, non-fatal on failure)
    8. Create employee_onboarding_progress rows from active templates
    9. Create leave_balances rows for current year for all active leave types
  - `src/pages/NewEmployeePage.tsx`: 2-step form (Personal Info → Job
    Details), React Hook Form + Zod, uses existing useCreateEmployee mutation.
  - `src/pages/EmployeesPage.tsx`: searchable list with avatar, initials,
    employee code, department, designation, status badges (Active/Probation/
    Resigned/Terminated/Future Joiner), join date. Employee role redirects
    to own profile. Owner sees Add Employee button.
- **2026-06-15 — M1 Phase 7: Dashboard + Route Polish**
  - `src/pages/DashboardPage.tsx` role-aware: Owner stat cards (headcount,
    pending leaves, regularizations), HR dashboard (pending approvals, team
    links), Employee dashboard (check-in/out buttons, leave balance cards,
    upcoming leaves), System Admin (system health, quick links).
  - Placeholder pages added for Reports (Attendance, Leave, Headcount,
    Regularization, Heatmap), Settings (Notifications, Onboarding Checklist),
    Employee Self-Profile.
  - All missing routes registered in App.tsx with RequireRole guards per
    SCREEN_INVENTORY.md access matrix.
   - `npm run typecheck` passes clean. `npm run build` passes clean
    (685 KB JS bundle, 31 KB CSS).
- **2026-06-15 — Post-M1 Fix: Edge Function Deployment**
  - Discovered `create-employee` Edge Function was only local — not deployed.
    Frontend calls to `*/functions/v1/create-employee` failed with CORS error
    because the Supabase API gateway had no route for the function.
  - Fixed `supabase/config.toml` functions section syntax for CLI compatibility.
  - Deployed via `npx supabase functions deploy create-employee` — bundles
    `index.ts` + all `_shared/` dependencies (`auth.ts`, `response.ts`,
    `supabase.ts`, `email.ts`) into the Supabase Edge Functions runtime.
  - Verified deployment: OPTIONS preflight returns 200, invalid JWT returns 401.
- **2026-06-15 — Orphaned Auth User Fix + Copy Password Dialog**
  - **Bug:** Manually deleting an employee from the `employees` table left the
    Supabase Auth user intact, causing `already been registered` on re-creation.
  - **Fix:** `create-employee` now detects existing auth users via retry loop:
    attempt `createUser` → if "already registered", `admin.listUsers()` to find
    user → `admin.deleteUser()` → retry `createUser`. Falls back to rollback.
  - **UX:** Replaced `toast.success` with a `Dialog` showing the temp password
    in a monospace code block with a clipboard copy button (Check icon state).
    Deployed to Supabase Edge Functions runtime.
  - `npm run typecheck` and `npm run build` both pass clean.

## Pending (next milestone — M2)
- Employee document vault (upload/view/download)
- Bulk employee import with CSV/XLSX
- Employee lifecycle events (promotion, transfer, salary revision)
- Activity timeline
- Org chart (P2)

## Decisions Made
- 2026-06-10: Adopted `main` / `dev` / `feature/*` branch workflow per
  `HR_Tool_Build_Guide_1.docx` — one active feature branch per milestone,
  build sequentially M1 → M5.
- 2026-06-10: `main` re-pointed to track `origin` (`fitmantramarketing-sys/salary-box`)
  instead of `upstream` (`Huzefman/salary-box`) — no push access to upstream.
- 2026-06-12: Used a PAT-based local Supabase MCP server (`.mcp.json` +
  `${SUPABASE_ACCESS_TOKEN}`) instead of the "claude.ai Supabase" OAuth
  connector — the OAuth connector kept authenticating against the wrong
  Supabase account (cross-Google-account mismatch) with no way to redirect it.

## Known Issues
- `origin/main` (fitmantramarketing-sys/salary-box) was reverted to a
  pre-scaffold state by commit `04bbe85` ("Merge pull request #1 from
  Huzefman/main"), which merged `upstream/main` (no scaffold) into the fork's
  `main`. `origin/main` currently does not contain the scaffold — local
  `main`/`dev`/`feature/auth-rbac` and `origin/feature/auth-rbac` are correct
  and unaffected. Decided 2026-06-10: leave `origin/main` as-is for now and
  reconcile when `dev` is merged into `main` at milestone completion (avoid an
  unreviewed force-push to a shared branch).
