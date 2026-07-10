import { useEffect, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth, RequireRole, RequireFirstPasswordSet } from '@/components/layout/RoleGuard'
import { Toaster } from '@/components/ui/sonner'

// Auth pages
import LoginPage from '@/pages/LoginPage'
import SetPasswordPage from '@/pages/SetPasswordPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import OnboardingPage from '@/pages/OnboardingPage'

// App pages
import DashboardPage from '@/pages/DashboardPage'
import EmployeesPage from '@/pages/EmployeesPage'
import OrgChartPage from '@/pages/OrgChartPage'
import EmployeeDetailPage from '@/pages/EmployeeDetailPage'
import NewEmployeePage from '@/pages/NewEmployeePage'
import EditEmployeePage from '@/pages/EditEmployeePage'
import BulkImportPage from '@/pages/BulkImportPage'
import AttendancePage from '@/pages/AttendancePage'
import TeamAttendancePage from '@/pages/TeamAttendancePage'
import EmployeeAttendanceDrillDownPage from '@/pages/EmployeeAttendanceDrillDownPage'
import RegularizationPage from '@/pages/RegularizationPage'
import LeaveDashboardPage from '@/pages/LeaveDashboardPage'
import ApplyLeavePage from '@/pages/ApplyLeavePage'
import LeaveApplicationDetailPage from '@/pages/LeaveApplicationDetailPage'
import TeamLeavePage from '@/pages/TeamLeavePage'
import HolidayCalendarPage from '@/pages/HolidayCalendarPage'
import DepartmentsPage from '@/pages/DepartmentsPage'
import DesignationsPage from '@/pages/DesignationsPage'
import ShiftsPage from '@/pages/ShiftsPage'
import LeaveTypesPage from '@/pages/LeaveTypesPage'
import AppConfigPage from '@/pages/AppConfigPage'
import IPWhitelistPage from '@/pages/IPWhitelistPage'
import GeofencePage from '@/pages/GeofencePage'
import LocationHistoryPage from '@/pages/LocationHistoryPage'
import SettingsNotificationsPage from '@/pages/SettingsNotificationsPage'
import SettingsOnboardingPage from '@/pages/SettingsOnboardingPage'
import SettingsLeaveBalancesPage from '@/pages/SettingsLeaveBalancesPage'
import EmployeeSelfProfilePage from '@/pages/EmployeeSelfProfilePage'
import ProfileEditReviewsPage from '@/pages/ProfileEditReviewsPage'
import ReportsAttendancePage from '@/pages/ReportsAttendancePage'
import ReportsLeavePage from '@/pages/ReportsLeavePage'
import ReportsHeadcountPage from '@/pages/ReportsHeadcountPage'
import ReportsRegularizationPage from '@/pages/ReportsRegularizationPage'
import ReportsHeatmapPage from '@/pages/ReportsHeatmapPage'
import ReportsHomePage from '@/pages/ReportsHomePage'
import DailyAttendanceReportPage from '@/pages/DailyAttendanceReportPage'
import RolesPage from '@/pages/RolesPage'
import AuditLogsPage from '@/pages/AuditLogsPage'

export default function App() {
  const { setAuth, clearAuth, setLoading, setPasswordRecovery } = useAuthStore()
  const navigate = useNavigate()

  /**
   * Fetch the employee record for a given auth UID and hydrate the store.
   * Returns the employee record or null if not found.
   */
  const hydrateEmployee = useCallback(
    async (user: Parameters<typeof setAuth>[0]) => {
      try {
        const { data: employee } = await supabase
          .from('employees')
          .select('*')
          .eq('auth_id', user.id)
          .single()

        if (employee) {
          setAuth(user, employee)
          return employee
        }
      } catch (err) {
        console.error('Failed to hydrate employee:', err)
        clearAuth()
        setLoading(false)
        return null
      }

      // Auth user exists but no employee row — edge case (orphaned auth account)
      setLoading(false)
      return null
    },
    [setAuth, setLoading, clearAuth]
  )

  useEffect(() => {
    // Flag scoped to this effect run — each Strict Mode double-invoke gets its own.
    // During mount init (setSession), all SIGNED_IN events are ignored so they
    // don't trigger a stray navigate('/dashboard'). After mount init completes,
    // subsequent SIGNED_IN events (from real logins) are handled normally.
    let mountInitComplete = false

    // 1. Check existing session on mount — use setSession() to reset the
    //    supabase-js internal state machine, preventing the "stuck after idle" hang
    ;(async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const projectRef = supabaseUrl?.match(/\/\/(.+?)\./)?.[1]
        let tokens: { access_token: string; refresh_token: string } | null = null

        // Read stored tokens from localStorage (Supabase stores them under a
        // project-specific key: sb-<project-ref>-auth-token)
        if (projectRef) {
          const stored = localStorage.getItem(`sb-${projectRef}-auth-token`)
          if (stored) {
            try {
              const parsed = JSON.parse(stored)
              if (parsed.access_token && parsed.refresh_token) {
                tokens = { access_token: parsed.access_token, refresh_token: parsed.refresh_token }
              }
            } catch { /* ignore parse errors */ }
          }
        }

        if (tokens) {
          // setSession() clears the corrupted in-memory state and rebuilds a
          // fresh state machine from the stored tokens, then validates them
          const { data: { session }, error } = await supabase.auth.setSession(tokens)

          if (!error && session?.user) {
            const employee = await hydrateEmployee(session.user)
            if (employee?.is_first_login) {
              navigate('/set-password', { replace: true })
            }
            return
          }
        }

        setLoading(false)
      } catch {
        setLoading(false)
      } finally {
        mountInitComplete = true
      }
    })()

    // 2. Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_IN' && session?.user) {
          // Ignore SIGNED_IN during mount init (from our own setSession call)
          if (!mountInitComplete) return
          const employee = await hydrateEmployee(session.user)
          if (employee?.is_first_login) {
            navigate('/set-password', { replace: true })
          } else if (employee) {
            const isPostPasswordSetup = useAuthStore.getState().isPostPasswordSetup
            if (isPostPasswordSetup) {
              useAuthStore.getState().setPostPasswordSetup(false)
            } else {
              navigate('/dashboard', { replace: true })
            }
          }
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          await hydrateEmployee(session.user)
        }

        if (event === 'SIGNED_OUT') {
          // Attempt to recover the session before signing out — handles
          // transient network blips during auto-refresh.
          const { data } = await supabase.auth.refreshSession()
          if (data.session) return

          clearAuth()
          navigate('/login', { replace: true })
        }

        if (event === 'PASSWORD_RECOVERY' && session?.user) {
          await hydrateEmployee(session.user)
          setPasswordRecovery(true)
          navigate('/set-password', { replace: true })
        }
      } catch (err) {
        console.error('onAuthStateChange handler failed:', err)
      }
    })

    return () => subscription.unsubscribe()
  }, [hydrateEmployee, clearAuth, setLoading, setPasswordRecovery, navigate])

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Protected — requires auth */}
        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Protected — requires first password to be set + layout shell */}
          <Route element={<RequireFirstPasswordSet />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Employees */}
              <Route path="/employees" element={<EmployeesPage />} />
              <Route element={<RequireRole allow={['owner', 'hr']} />}>
                <Route path="/org-chart" element={<OrgChartPage />} />
              </Route>
              <Route element={<RequireRole allow={['owner']} />}>
                <Route path="/employees/new" element={<NewEmployeePage />} />
                <Route path="/employees/bulk-import" element={<BulkImportPage />} />
              </Route>
              <Route element={<RequireRole allow={['owner', 'hr', 'employee']} />}>
                <Route path="/employees/:id/edit" element={<EditEmployeePage />} />
              </Route>
              <Route path="/employees/:id" element={<EmployeeDetailPage />} />

              {/* Attendance */}
              <Route element={<RequireRole allow={['hr', 'employee']} />}>
                <Route path="/attendance" element={<AttendancePage />} />
              </Route>
              <Route element={<RequireRole allow={['owner', 'hr']} />}>
                <Route path="/attendance/team" element={<TeamAttendancePage />} />
                <Route path="/attendance/:employeeId" element={<EmployeeAttendanceDrillDownPage />} />
              </Route>
              <Route path="/attendance/regularization" element={<RegularizationPage />} />

              {/* Leave */}
              <Route path="/leave" element={<LeaveDashboardPage />} />
              <Route path="/leave/apply" element={<ApplyLeavePage />} />
              <Route path="/leave/applications/:id" element={<LeaveApplicationDetailPage />} />
              <Route element={<RequireRole allow={['owner', 'hr']} />}>
                <Route path="/leave/team" element={<TeamLeavePage />} />
              </Route>
              <Route path="/leave/holidays" element={<HolidayCalendarPage />} />

              {/* Settings */}
              <Route element={<RequireRole allow={['owner']} />}>
                <Route path="/settings/departments" element={<DepartmentsPage />} />
                <Route path="/settings/designations" element={<DesignationsPage />} />
                <Route path="/settings/leave-types" element={<LeaveTypesPage />} />
                <Route path="/settings/app-config" element={<AppConfigPage />} />
              </Route>
              <Route element={<RequireRole allow={['owner', 'hr']} />}>
                <Route path="/settings/shifts" element={<ShiftsPage />} />
              </Route>
              <Route element={<RequireRole allow={['owner', 'system_admin']} />}>
                <Route path="/settings/ip-whitelist" element={<IPWhitelistPage />} />
                <Route path="/settings/geofence" element={<GeofencePage />} />
                <Route path="/settings/location-history" element={<LocationHistoryPage />} />
              </Route>
              <Route element={<RequireRole allow={['owner']} />}>
                <Route path="/settings/notifications" element={<SettingsNotificationsPage />} />
                <Route path="/settings/onboarding-checklist" element={<SettingsOnboardingPage />} />
                <Route path="/settings/roles" element={<RolesPage />} />
              </Route>
              <Route element={<RequireRole allow={['owner', 'hr']} />}>
                <Route path="/settings/leave-balances" element={<SettingsLeaveBalancesPage />} />
              </Route>

              {/* Employee self-profile */}
              <Route path="/employees/me" element={<EmployeeSelfProfilePage />} />
              <Route element={<RequireRole allow={['owner', 'hr']} />}>
                <Route path="/employees/profile-edits" element={<ProfileEditReviewsPage />} />
              </Route>

              {/* Reports */}
              <Route element={<RequireRole allow={['owner', 'hr', 'employee', 'system_admin']} />}>
                <Route path="/reports" element={<ReportsHomePage />} />
              </Route>
              <Route element={<RequireRole allow={['owner', 'hr', 'employee']} />}>
                <Route path="/reports/attendance" element={<ReportsAttendancePage />} />
              </Route>
              <Route element={<RequireRole allow={['owner', 'hr']} />}>
                <Route path="/reports/leave" element={<ReportsLeavePage />} />
              </Route>
              <Route element={<RequireRole allow={['owner', 'system_admin']} />}>
                <Route path="/reports/headcount" element={<ReportsHeadcountPage />} />
              </Route>
              <Route element={<RequireRole allow={['owner']} />}>
                <Route path="/reports/regularization" element={<ReportsRegularizationPage />} />
                <Route path="/reports/heatmap" element={<ReportsHeatmapPage />} />
                <Route path="/reports/daily" element={<DailyAttendanceReportPage />} />
              </Route>

              {/* Audit Logs */}
              <Route element={<RequireRole allow={['owner', 'system_admin']} />}>
                <Route path="/audit-logs" element={<AuditLogsPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}
