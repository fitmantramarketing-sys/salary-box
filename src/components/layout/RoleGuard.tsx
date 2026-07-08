import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuth'
import type { Role } from '@/types'

/**
 * RequireAuth — blocks unauthenticated access.
 * Shows a spinner while the session is loading.
 * If auth stays stuck for >10s, hard-reloads to nuke the corrupted supabase state machine.
 */
export function RequireAuth() {
  const { user, isLoading } = useAuthStore()

  useEffect(() => {
    if (!isLoading) return
    // One-time hard reload per tab session to nuke corrupted supabase-js state machine.
    // After the reload, the sessionStorage flag prevents a second reload.
    const alreadyReloaded = sessionStorage.getItem('authFreshReload')
    if (alreadyReloaded) return
    sessionStorage.setItem('authFreshReload', '1')
    window.location.reload()
  }, [isLoading])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}

/**
 * RequireRole — blocks access for users without the required role.
 * Redirects to /dashboard if the user's role is not in the allowed list.
 */
export function RequireRole({ allow }: { allow: Role[] }) {
  const role = useAuthStore((s) => s.role)
  if (!role || !allow.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}

/**
 * RequireFirstPasswordSet — blocks users who haven't set their password yet.
 * Redirects to /set-password if is_first_login is true.
 */
export function RequireFirstPasswordSet() {
  const employee = useAuthStore((s) => s.employee)

  if (employee?.is_first_login) {
    return <Navigate to="/set-password" replace />
  }

  return <Outlet />
}
