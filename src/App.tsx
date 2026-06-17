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
import EmployeeDetailPage from '@/pages/EmployeeDetailPage'
import NewEmployeePage from '@/pages/NewEmployeePage'
import EditEmployeePage from '@/pages/EditEmployeePage'
import BulkImportPage from '@/pages/BulkImportPage'
import AttendancePage from '@/pages/AttendancePage'
import TeamAttendancePage from '@/pages/TeamAttendancePage'
import RegularizationPage from '@/pages/RegularizationPage'
import LeaveDashboardPage from '@/pages/LeaveDashboardPage'
import ApplyLeavePage from '@/pages/ApplyLeavePage'
import LeaveApplicationDetailPage from '@/pages/LeaveApplicationDetailPage'
import CompOffPage from '@/pages/CompOffPage'
import TeamLeavePage from '@/pages/TeamLeavePage'
import HolidayCalendarPage from '@/pages/HolidayCalendarPage'
import DepartmentsPage from '@/pages/DepartmentsPage'
import DesignationsPage from '@/pages/DesignationsPage'
import ShiftsPage from '@/pages/ShiftsPage'
import LeaveTypesPage from '@/pages/LeaveTypesPage'
import AppConfigPage from '@/pages/AppConfigPage'
import IPWhitelistPage from '@/pages/IPWhitelistPage'
import GeofencePage from '@/pages/GeofencePage'
import SettingsNotificationsPage from '@/pages/SettingsNotificationsPage'
import SettingsOnboardingPage from '@/pages/SettingsOnboardingPage'
import EmployeeSelfProfilePage from '@/pages/EmployeeSelfProfilePage'
import ReportsAttendancePage from '@/pages/ReportsAttendancePage'
import ReportsLeavePage from '@/pages/ReportsLeavePage'
import ReportsHeadcountPage from '@/pages/ReportsHeadcountPage'
import ReportsRegularizationPage from '@/pages/ReportsRegularizationPage'
import ReportsHeatmapPage from '@/pages/ReportsHeatmapPage'

export default function App() {
  const { setAuth, clearAuth, setLoading, setPasswordRecovery } = useAuthStore()
  const navigate = useNavigate()

  /**
   * Fetch the employee record for a given auth UID and hydrate the store.
   * Returns the employee record or null if not found.
   */
  const hydrateEmployee = useCallback(
    async (user: Parameters<typeof setAuth>[0]) => {
      const { data: employee } = await supabase
        .from('employees')
        .select('*')
        .eq('auth_id', user.id)
        .single()

      if (employee) {
        setAuth(user, employee)
        return employee
      }

      // Auth user exists but no employee row — edge case (orphaned auth account)
      setLoading(false)
      return null
    },
    [setAuth, setLoading]
  )

  useEffect(() => {
    // 1. Check existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const employee = await hydrateEmployee(session.user)
        // If first login, redirect to set-password
        if (employee?.is_first_login) {
          navigate('/set-password', { replace: true })
        }
      } else {
        setLoading(false)
      }
    })

    // 2. Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const employee = await hydrateEmployee(session.user)
        if (employee?.is_first_login) {
          navigate('/set-password', { replace: true })
        } else if (employee) {
          // If the user just completed set-password, don't override the
          // onboarding navigation — SetPasswordForm handles it.
          const isPostPasswordSetup = useAuthStore.getState().isPostPasswordSetup
          if (isPostPasswordSetup) {
            useAuthStore.getState().setPostPasswordSetup(false)
          } else {
            navigate('/dashboard', { replace: true })
          }
        }
      }

      if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Re-hydrate on token refresh to pick up any role/employee changes
        await hydrateEmployee(session.user)
      }

      if (event === 'SIGNED_OUT') {
        clearAuth()
        navigate('/login', { replace: true })
      }

      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        // User clicked the password reset link from email
        await hydrateEmployee(session.user)
        setPasswordRecovery(true)
        navigate('/set-password', { replace: true })
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
              <Route element={<RequireRole allow={['owner']} />}>
                <Route path="/employees/new" element={<NewEmployeePage />} />
                <Route path="/employees/bulk-import" element={<BulkImportPage />} />
              </Route>
              <Route element={<RequireRole allow={['owner', 'hr', 'employee']} />}>
                <Route path="/employees/:id/edit" element={<EditEmployeePage />} />
              </Route>
              <Route path="/employees/:id" element={<EmployeeDetailPage />} />

              {/* Attendance */}
              <Route path="/attendance" element={<AttendancePage />} />
              <Route element={<RequireRole allow={['owner', 'hr']} />}>
                <Route path="/attendance/team" element={<TeamAttendancePage />} />
              </Route>
              <Route path="/attendance/regularization" element={<RegularizationPage />} />

              {/* Leave */}
              <Route path="/leave" element={<LeaveDashboardPage />} />
              <Route path="/leave/apply" element={<ApplyLeavePage />} />
              <Route path="/leave/applications/:id" element={<LeaveApplicationDetailPage />} />
              <Route path="/leave/comp-off/request" element={<CompOffPage />} />
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
                <Route path="/settings/holidays" element={<HolidayCalendarPage />} />
              </Route>
              <Route element={<RequireRole allow={['owner', 'system_admin']} />}>
                <Route path="/settings/ip-whitelist" element={<IPWhitelistPage />} />
                <Route path="/settings/geofence" element={<GeofencePage />} />
              </Route>
              <Route element={<RequireRole allow={['owner']} />}>
                <Route path="/settings/notifications" element={<SettingsNotificationsPage />} />
                <Route path="/settings/onboarding-checklist" element={<SettingsOnboardingPage />} />
              </Route>

              {/* Employee self-profile */}
              <Route path="/employees/me" element={<EmployeeSelfProfilePage />} />

              {/* Reports */}
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
