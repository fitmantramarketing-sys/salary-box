# ARCHITECTURE.md
## Internal HR Tool — Frontend Architecture Reference
**Source of truth:** HR_Tool_PRD_v1 (June 2026)
**Status:** Implementation-ready specification. No code.

---

## Overview

This document describes the frontend architecture decisions for the HR tool. It is a companion to `CLAUDE.md` (which lists tech stack and folder structure) and focuses on the patterns each AI agent or developer must follow when writing feature code.

---

## 1. Folder Structure Conventions

### Top-level

```
src/
├── lib/            ← shared client setup (supabase, queryClient, date utils)
├── types/          ← generated DB types + hand-written domain types
├── hooks/          ← cross-feature React hooks (auth, role, notifications)
├── components/     ← shared UI (shadcn primitives in ui/, layout shell in layout/)
├── features/       ← all feature code, grouped by domain
└── pages/          ← route entry points, thin shells that compose features
```

### Feature folder anatomy

Every domain in `src/features/` follows the same shape:

```
features/
└── attendance/
    ├── api.ts          ← Supabase direct queries for this domain (reads only)
    ├── hooks.ts        ← TanStack Query hooks that wrap api.ts
    ├── mutations.ts    ← TanStack Query mutations that call Edge Functions
    ├── schemas.ts      ← Zod schemas for form validation in this domain
    ├── types.ts        ← domain-specific TypeScript types beyond DB types
    ├── utils.ts        ← pure helper functions (date math, status formatting, etc.)
    └── components/
        ├── AttendanceTable.tsx
        ├── CheckInButton.tsx
        └── ...
```

**Rules:**
- `api.ts` only contains functions that call `supabase.from(...)`. No business logic.
- `hooks.ts` only imports from `api.ts` and wraps in `useQuery` or `useSuspenseQuery`.
- `mutations.ts` only calls Edge Functions via `fetch('/functions/v1/...')`. No direct DB writes from the browser.
- Components import only from their own feature folder or from `src/components/` or `src/hooks/`. Never cross-feature imports unless via a re-exported public API.

---

## 2. Supabase Client Setup

### Browser client (`src/lib/supabase.ts`)

The browser uses the **anon key** and the authenticated user's JWT. This is the only Supabase client that should exist in `src/`. It is safe to import anywhere in the frontend.

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

**Never import the service-role key in `src/`.** The service-role key lives only inside Edge Functions (`supabase/functions/_shared/supabase.ts`).

### Edge Function client (`supabase/functions/_shared/supabase.ts`)

Used only inside Edge Functions (Deno runtime). Bypasses RLS for server-side operations.

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}
```

---

## 3. TypeScript Type Strategy

### Auto-generated types

Run `npm run types:gen` (defined in CLAUDE.md) after every migration. This produces `src/types/database.types.ts` from the live Supabase schema. **Never hand-edit this file.**

### Using generated types

```typescript
import type { Database } from '@/types/database.types'

// Row type for a table
type Employee = Database['public']['Tables']['employees']['Row']

// Insert type (optional fields match DB defaults)
type EmployeeInsert = Database['public']['Tables']['employees']['Insert']

// Update type (all fields optional)
type EmployeeUpdate = Database['public']['Tables']['employees']['Update']
```

### Hand-written domain types (`src/types/index.ts`)

Export supplemental types that are not derivable from the schema:
- Edge Function request/response shapes
- UI-specific enums and display labels
- Composed types derived from joins

```typescript
// Example: what the check-in Edge Function returns
export type CheckInResponse = {
  data: {
    attendance_record_id: string
    check_in_time: string
    is_late: boolean
    is_geo_flagged: boolean
  }
}
```

---

## 4. State Management

### Rule: server state vs client state

| Data type | Tool | Location |
|---|---|---|
| Database rows (employees, attendance, leave) | TanStack Query | `features/*/hooks.ts` |
| Authenticated user identity and role | Zustand | `src/hooks/useAuth.ts` |
| Form draft state | React Hook Form | component-local |
| UI transient state (modal open, selected tab) | useState | component-local |

**Never use Zustand for server data.** TanStack Query is the single source of truth for anything that lives in Supabase.

### TanStack Query setup (`src/lib/queryClient.ts`)

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes — most HR data doesn't change frequently
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,    // HR app, not a real-time dashboard
    },
    mutations: {
      onError: (error) => {
        // Global toast for unexpected mutation failures
        console.error('Mutation error:', error)
      },
    },
  },
})
```

### Query key conventions

Keys follow `['domain', 'resource', ...discriminators]`. No magic strings outside `hooks.ts`.

```typescript
// All employees
['employees', 'list']

// Single employee
['employees', 'detail', employeeId]

// Attendance for one employee in one month
['attendance', 'list', employeeId, year, month]

// Leave balances for one employee in one year
['leave', 'balances', employeeId, year]

// All pending leave applications (admin view)
['leave', 'applications', 'pending']

// App config
['config', 'app']
```

### Zustand auth store (`src/hooks/useAuth.ts`)

```typescript
import { create } from 'zustand'

type AuthState = {
  user: User | null
  employee: Employee | null   // employees row for the logged-in user
  role: 'owner' | 'hr' | 'employee' | 'system_admin' | null
  setAuth: (user: User, employee: Employee) => void
  clearAuth: () => void
}

export const useAuth = create<AuthState>()(...)
```

Populated once on session load via `supabase.auth.onAuthStateChange`. Never call `useAuth` in `api.ts` functions — pass `actorId` as a parameter instead.

---

## 5. API Layer Patterns

### Reads — direct Supabase query in `api.ts`

All reads use the browser's anon client (RLS enforces access). Write pure async functions with typed return values.

```typescript
// features/employees/api.ts
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type Employee = Database['public']['Tables']['employees']['Row']

export async function fetchEmployee(id: string): Promise<Employee> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}
```

### Reads — hooks in `hooks.ts`

```typescript
// features/employees/hooks.ts
import { useQuery } from '@tanstack/react-query'
import { fetchEmployee } from './api'

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employees', 'detail', id],
    queryFn: () => fetchEmployee(id),
    enabled: !!id,
  })
}
```

### Writes — Edge Function calls in `mutations.ts`

All writes that carry business logic go through Edge Functions, not direct DB writes.

```typescript
// features/attendance/mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

async function callEdgeFunction<TBody, TResponse>(
  path: string,
  body: TBody
): Promise<TResponse> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${path}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  )

  const json = await res.json()
  if (!res.ok) throw json.error   // structured error from Edge Function
  return json.data
}

export function useCheckIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (coords?: { latitude: number; longitude: number }) =>
      callEdgeFunction('check-in', coords ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
  })
}
```

---

## 6. Form Patterns (React Hook Form + Zod)

### Schema in `schemas.ts`

Define the Zod schema once; derive the TypeScript type from it.

```typescript
// features/leave/schemas.ts
import { z } from 'zod'

export const submitLeaveSchema = z.object({
  leave_type_id: z.string().uuid('Select a leave type'),
  from_date: z.string().min(1, 'Start date is required'),
  to_date: z.string().min(1, 'End date is required'),
  is_half_day: z.boolean().default(false),
  half_day_period: z.enum(['morning', 'afternoon']).nullable().optional(),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  attachment_path: z.string().nullable().optional(),
})

export type SubmitLeaveForm = z.infer<typeof submitLeaveSchema>
```

### Component pattern

```typescript
// features/leave/components/ApplyLeaveForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { submitLeaveSchema, type SubmitLeaveForm } from '../schemas'
import { useSubmitLeave } from '../mutations'

export function ApplyLeaveForm() {
  const { mutate, isPending, error } = useSubmitLeave()
  const form = useForm<SubmitLeaveForm>({
    resolver: zodResolver(submitLeaveSchema),
    defaultValues: { is_half_day: false },
  })

  const onSubmit = (values: SubmitLeaveForm) => {
    mutate(values, {
      onSuccess: () => form.reset(),
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* shadcn FormField components */}
        {error && <p className="text-destructive">{error.message}</p>}
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Submitting...' : 'Apply Leave'}
        </Button>
      </form>
    </Form>
  )
}
```

**Rules:**
- Never submit a form directly to Supabase — always go through the mutation (which calls an Edge Function).
- The `error` from `useMutation` is the parsed Edge Function error object. Display `error.message` to the user.
- Server-side validation (Edge Functions) is the authority. Client-side Zod validation is UX-only.

---

## 7. Routing Architecture

### Route file convention (`src/pages/`)

Pages are thin shells. All data-fetching and rendering logic lives in feature components.

```typescript
// src/pages/LeaveApplicationPage.tsx
import { ApplyLeaveForm } from '@/features/leave/components/ApplyLeaveForm'
import { LeaveBalanceSummary } from '@/features/leave/components/LeaveBalanceSummary'

export default function LeaveApplicationPage() {
  return (
    <div className="space-y-6">
      <LeaveBalanceSummary />
      <ApplyLeaveForm />
    </div>
  )
}
```

### Router setup (`src/App.tsx`)

Use React Router v6 data router with role-based guard components.

```typescript
// Route protection pattern
function RequireRole({ allowed, children }: { allowed: string[]; children: ReactNode }) {
  const { role } = useAuth()
  if (!role || !allowed.includes(role)) return <Navigate to="/unauthorized" replace />
  return <>{children}</>
}

// Route definition
{
  path: '/settings/app-config',
  element: (
    <RequireRole allowed={['owner']}>
      <AppConfigPage />
    </RequireRole>
  )
}
```

Role-to-route mapping is defined in `src/lib/routes.ts` — a single source of truth for which roles can access which paths. This mirrors the Screen × Role table in `SCREEN_INVENTORY.md`.

---

## 8. Error Handling

### Edge Function errors

Edge Functions return `{ error: { code, message, details? } }` on failure. The `callEdgeFunction` wrapper rethrows `json.error` so React Query's `error` state receives the structured object.

### Display rules

| Error code | UI treatment |
|---|---|
| `UNAUTHORIZED` | Redirect to `/login` |
| `FORBIDDEN` | Show inline error: "You don't have permission to do this." |
| `NOT_FOUND` | Show inline error or 404 page |
| `VALIDATION_ERROR` | Show `error.message` inline near the form (never a toast) |
| `CONFLICT` | Show `error.message` inline |
| `DUPLICATE` | Show `error.message` inline with offer to resolve |
| `INTERNAL_ERROR` | Show toast: "Something went wrong. Please try again." |

### Query errors

TanStack Query error boundaries catch query failures. Wrap each page in an `<ErrorBoundary>` that renders a retry button.

---

## 9. Date and Time Handling

All display dates are in **IST (Asia/Kolkata, UTC+5:30)**. All stored timestamps are UTC (Supabase default). All comparisons for business rules (leave dates, regularization window, carry-forward expiry) are computed server-side in Edge Functions.

**Use `date-fns-tz` for all timezone-aware formatting in the browser.**

```typescript
import { formatInTimeZone } from 'date-fns-tz'

const IST = 'Asia/Kolkata'

// Display a UTC timestamp in IST
formatInTimeZone(new Date(attendance.check_in_time), IST, 'dd MMM yyyy, hh:mm a')
// → "09 Jun 2026, 09:05 AM"

// Convert a local date input to a date string for the API (no timezone conversion needed for date-only fields)
format(new Date(form.from_date), 'yyyy-MM-dd')
// → "2026-06-15"
```

**Rules:**
- Never use `new Date().toLocaleDateString()` — it uses the browser locale, not IST.
- Date-only fields (`from_date`, `join_date`) are always stored as `date` in Postgres — send as `YYYY-MM-DD` strings, no time component.
- Timestamp fields (`check_in_time`, `applied_at`) are stored as `timestamptz` — the server sets them, never the client.

---

## 10. Notification Pattern

In-app notifications are stored in the `notifications` table. Poll with a short `refetchInterval` and display via a notification bell in the layout shell.

```typescript
// features/notifications/hooks.ts
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: fetchUnreadNotifications,
    refetchInterval: 30 * 1000,    // poll every 30s
  })
}
```

Mark as read via a direct Supabase update (no Edge Function needed — no business logic, just setting `is_read = true`):

```typescript
await supabase
  .from('notifications')
  .update({ is_read: true })
  .eq('id', notificationId)
```

---

## 11. Role-Based UI Rendering

Use `useAuth` to read the current role and conditionally render UI. Never use role checks to hide data that RLS already restricts — RLS is defence in depth, UI checks are convenience only.

```typescript
import { useAuth } from '@/hooks/useAuth'

function LeaveActionsPanel({ application }) {
  const { role } = useAuth()

  return (
    <div>
      {(role === 'owner' || role === 'hr') && (
        <ApproveRejectButtons applicationId={application.id} />
      )}
      {role === 'employee' && application.status === 'pending' && (
        <CancelButton applicationId={application.id} />
      )}
    </div>
  )
}
```

**Do not show HR-only fields (e.g. current_salary, bank details) based solely on role check.** The query itself will return null/empty for those fields due to RLS. If the field is null, render nothing.

---

## 12. Onboarding and First Login

On first login (`employees.is_first_login = true`):
1. Force the user to the `/onboarding` route (enforced in `RequireAuth` wrapper).
2. Display the checklist from `employee_onboarding_progress`.
3. On each item complete: update `employee_onboarding_progress` directly via Supabase (allowed per ROLE_RULES — employee can mark own items complete).
4. When all required items are complete: call an Edge Function `complete-onboarding` that sets `is_first_login = false`.

---

## 13. File Upload Pattern

Documents are uploaded via the `upload-document` Edge Function (multipart form data). Never upload directly from the browser to Supabase Storage — the Edge Function validates file type, size, and computes the SHA-256 hash for duplicate detection.

```typescript
async function uploadDocument(employeeId: string, file: File, documentType: string) {
  const formData = new FormData()
  formData.append('employee_id', employeeId)
  formData.append('document_type', documentType)
  formData.append('file', file)

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-document`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
      // No Content-Type header — let the browser set it with the boundary
    }
  )

  const json = await res.json()
  if (!res.ok) throw json.error
  return json.data
}
```

Documents are never displayed with a permanent URL. Always call `generate-presigned-url` to get a time-limited link before rendering a preview or download link.

---

## 14. Build Order

Feature modules should be built in this order to respect data dependencies:

| Milestone | Features |
|---|---|
| M1 — Foundation | Auth, layout shell, routing, employee CRUD (Owner), department/designation management |
| M2 — Attendance | Check-in/check-out, auto-checkout cron, attendance calendar, WFH logging, regularization |
| M3 — Leave | Leave types config, leave balances, apply/approve/reject, cancellation flow, holiday calendar with opt-in |
| M4 — Advanced Leave | Comp-off, carry-forward lapse, SLA escalation, notifications |
| M5 — Reports & Config | Reports screen, app config management, audit log viewer, bulk import |

Do not build M2 features that depend on M1 data (shifts, departments) until M1 is complete and seeded.
