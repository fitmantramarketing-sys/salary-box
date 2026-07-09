import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuth'
import type { Role } from '@/types'

export function RequireAuth() {
  const { user, isLoading } = useAuthStore()

  useEffect(() => {
    if (!isLoading) {
      // Auth resolved — clear reload counter so next cold open gets a retry
      sessionStorage.removeItem('authReloadCount')
      return
    }

    // Don't attempt more than 2 consecutive reloads in this tab session
    if (Number(sessionStorage.getItem('authReloadCount') || '0') >= 2) return

    // Wait 4 seconds for auth to settle; if still stuck, reload the page.
    // This nukes any corrupted supabase-js internal state and starts fresh.
    const timer = setTimeout(() => {
      const count = Number(sessionStorage.getItem('authReloadCount') || '0')
      sessionStorage.setItem('authReloadCount', String(count + 1))
      window.location.reload()
    }, 1000)

    return () => clearTimeout(timer)
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
