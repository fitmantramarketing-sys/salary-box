import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import { useEmployee } from '@/features/employees/hooks'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmployeeOverviewTab } from './EmployeeOverviewTab'
import { EmployeeDocumentsTab } from './EmployeeDocumentsTab'
import { EmployeeBankDetailsTab } from './EmployeeBankDetailsTab'
import { EmployeeLifecycleTab } from './EmployeeLifecycleTab'
import { EmployeeAttendanceTab } from './EmployeeAttendanceTab'
import { EmployeeLeaveTab } from './EmployeeLeaveTab'
import { EmployeeOnboardingTab } from './EmployeeOnboardingTab'
import { EmployeeActivityTab } from './EmployeeActivityTab'

type Props = { employeeId: string }

function getAdminTabs(employeeRole?: string) {
  const tabs: { value: string; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'documents', label: 'Documents' },
    { value: 'bank_details', label: 'Bank Details' },
    { value: 'lifecycle', label: 'Lifecycle' },
    { value: 'activity', label: 'Activity' },
  ]
  if (employeeRole !== 'owner') {
    tabs.push({ value: 'attendance', label: 'Attendance' })
  }
  tabs.push(
    { value: 'leave', label: 'Leave' },
    { value: 'onboarding', label: 'Onboarding' },
  )
  return tabs
}

const SELF_TABS = [
  { value: 'overview', label: 'My Profile' },
  { value: 'documents', label: 'My Documents' },
  { value: 'onboarding', label: 'Onboarding' },
] as const

export function EmployeeDetailTabs({ employeeId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: employee, isLoading, error } = useEmployee(employeeId)
  const { isOwner, isHR, isSystemAdmin } = useRole()
  const currentEmployee = useAuthStore((s) => s.employee)

  const activeTab = searchParams.get('tab') || 'overview'
  const onTabChange = (value: string) => setSearchParams({ tab: value })

  const isOwnProfile = currentEmployee?.id === employeeId
  const canViewAll = isOwner || isHR || isSystemAdmin
  const adminTabs = getAdminTabs(employee?.role)
  const tabs = isOwnProfile && !canViewAll ? SELF_TABS : adminTabs

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-destructive">
          Error loading employee: {(error as Error).message}
        </CardContent>
      </Card>
    )
  }

  if (!employee) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Team member not found
        </CardContent>
      </Card>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
      <TabsList className="flex-wrap">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview">
        <EmployeeOverviewTab employee={employee} />
      </TabsContent>

      <TabsContent value="documents">
        <EmployeeDocumentsTab employeeId={employeeId} />
      </TabsContent>

      {canViewAll && (
        <TabsContent value="bank_details">
          <EmployeeBankDetailsTab employeeId={employeeId} />
        </TabsContent>
      )}

      {canViewAll && (
        <TabsContent value="lifecycle">
          <EmployeeLifecycleTab employeeId={employeeId} />
        </TabsContent>
      )}

      {canViewAll && (
        <TabsContent value="activity">
          <EmployeeActivityTab employeeId={employeeId} />
        </TabsContent>
      )}

      {canViewAll && employee?.role !== 'owner' && (
        <TabsContent value="attendance">
          <EmployeeAttendanceTab employeeId={employeeId} />
        </TabsContent>
      )}

      {canViewAll && (
        <TabsContent value="leave">
          <EmployeeLeaveTab employeeId={employeeId} />
        </TabsContent>
      )}

      <TabsContent value="onboarding">
        <EmployeeOnboardingTab employeeId={employeeId} />
      </TabsContent>
    </Tabs>
  )
}
