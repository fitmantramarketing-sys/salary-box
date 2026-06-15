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
Last updated: 2026-06-15
Active branch: experiment-new-agent
Just completed: M1 Phase 1–7 (full M1 milestone).
Current session: Fixed orphaned auth user handling + copy temp password dialog.

### Phase 1-2: Bootstrap + Auth Flow (previous session)
- Migration `0009_bootstrap_owner` applied: created first Owner auth.users
  account (fitmantrabyamanatkagzi@gmail.com) + linked `employees` row
  (EMP-2026-0001, role=owner, is_first_login=true). Verified via execute_sql.
- Initialized shadcn/ui (components.json, tailwind.config, vite.config) and
  installed 17 UI primitives: Button, Input, Label, Card, Form, Toast, Toaster,
  Separator, Badge, Table, DropdownMenu, Sheet, ScrollArea, Avatar, Dialog,
  Sonner, Chart.
- Built auth flow: LoginPage, SetPasswordPage, ForgotPasswordPage — all
  functional with premium glassmorphism design.
- App.tsx rewritten with onAuthStateChange handling, employee hydration,
  first-login redirect logic.
- RoleGuard.tsx: RequireAuth, RequireRole, RequireFirstPasswordSet.
- Sonner toast provider, fixed tsconfig/node build issues.

### Phase 3-7: Sidebar Nav + CRUD Pages + Edge Function + Dashboard
- Sidebar (`Sidebar.tsx`) fully rewritten with role-aware navigation groups
  per SCREEN_INVENTORY.md — Owner, HR, Employee, System Admin each see
  their own nav tree.
- Department CRUD (`DepartmentsPage.tsx`): tree view with add/edit/deactivate,
  max 3 nesting levels, Owner-only.
- Designation CRUD (`DesignationsPage.tsx`): grouped by department,
  add/edit/deactivate, Owner-only.
- `create-employee` Edge Function fully implemented: email uniqueness check,
  auto EMP-YYYY-NNNN code gen, future_joiner logic, Supabase Auth account
  creation, welcome email via Resend, onboarding progress + leave balance
  rows.
- `NewEmployeePage.tsx`: 2-step form (Personal Info + Job Details), React Hook
  Form + Zod, Owner-only.
- `EmployeesPage.tsx`: searchable employee list with avatar/code/dept/designation/
  status badges; Employee role redirects to own profile.
- `DashboardPage.tsx`: role-aware — Owner sees stats cards, HR sees pending
  approvals, Employee sees check-in buttons + leave balances, System Admin
  sees system health.
- Placeholder pages added: Reports (Attendance/Leave/Headcount/Regularization/
  Heatmap), Settings (Notifications/Onboarding), Employee Self-Profile.
- All new routes registered in `App.tsx` with proper `RequireRole` guards.
- `create-employee` Edge Function deployed to production (`hqiggiqwyxjiltltvoay`).
  Fixed CORS issue — was failing because function was only local, not deployed.
  Deployed via `npx supabase functions deploy create-employee`.
- `npm run typecheck` and `npm run build` both pass clean.

### Current session (2026-06-15) — orphaned auth user fix + copy password
- **Bug:** Manually deleting an employee from the `employees` table left their
  Supabase Auth user intact. Re-creating the same person failed with "A user
  with this email address has already been registered".
- **Fix:** `create-employee` Edge Function now detects existing auth users,
  deletes them via `admin.deleteUser()`, then recreates a fresh auth account.
  Uses a retry loop (attempt → delete on conflict → retry → rollback on
  failure).
- **UX:** Replaced the Sonner toast with a `Dialog` showing the temp password
  in a monospace code block with a copy-to-clipboard button (Check icon on
  success). Employee detail page is a placeholder (M2 scope).
- Committed as `21c0006` on `experiment-new-agent`.

### Known issues
- `origin/main` (fitmantramarketing-sys/salary-box on GitHub) was
  reverted to a pre-scaffold state by a PR merge from `upstream/main`
  (`04bbe85`, "Merge pull request #1 from Huzefman/main") — it currently does
  NOT have the scaffold. Local `main`/`dev`/`feature/auth-rbac` and
  `origin/feature/auth-rbac` all have the full scaffold and are correct.
  Do not push local `main` to `origin/main` without reconciling this — resolve
  when `dev` merges into `main` at milestone completion (see PROGRESS.md).
- RESEND_API_KEY not configured in Supabase project secrets → welcome email
  silently fails (non-fatal try/catch).
- EmployeeDetailPage is a placeholder — not yet implemented (M2 scope).

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
  after schema changes. The current generator (PostgrestVersion 14.5) already
  includes `Relationships: [...]` per table automatically.

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
    _shared/            ← supabase.ts, auth.ts, response.ts, email.ts
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
