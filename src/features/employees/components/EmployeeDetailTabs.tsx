import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import { useEmployee } from '@/features/employees/hooks'
import { useDeactivateEmployee, useReactivateEmployee } from '@/features/employees/mutations'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, UserX, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { EmployeeOverviewTab } from './EmployeeOverviewTab'
import { ChangeLoginEmailDialog } from './ChangeLoginEmailDialog'
import { DeleteEmployeeDialog } from './DeleteEmployeeDialog'
import { EmployeeDocumentsTab } from './EmployeeDocumentsTab'
import { EmployeeBankDetailsTab } from './EmployeeBankDetailsTab'
import { EmployeeLifecycleTab } from './EmployeeLifecycleTab'
import { EmployeeAttendanceTab } from './EmployeeAttendanceTab'
import { EmployeeLeaveTab } from './EmployeeLeaveTab'
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
  tabs.push({ value: 'leave', label: 'Leave' })
  return tabs
}

const SELF_TABS = [
  { value: 'overview', label: 'My Profile' },
  { value: 'documents', label: 'My Documents' },
  { value: 'bank_details', label: 'Bank Details' },
] as const

export function EmployeeDetailTabs({ employeeId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: employee, isLoading, error } = useEmployee(employeeId)
  const { isOwner, isHR, isSystemAdmin } = useRole()
  const currentEmployee = useAuthStore((s) => s.employee)
  const deactivateMutation = useDeactivateEmployee()
  const reactivateMutation = useReactivateEmployee()
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [reactivateOpen, setReactivateOpen] = useState(false)
  const [actionReason, setActionReason] = useState('')

  const activeTab = searchParams.get('tab') || 'overview'
  const onTabChange = (value: string) => setSearchParams({ tab: value })

  const isOwnProfile = currentEmployee?.id === employeeId
  const canViewAll = isOwner || isHR || isSystemAdmin
  const adminTabs = getAdminTabs(employee?.role)
  const tabs = isOwnProfile && !canViewAll ? SELF_TABS : adminTabs

  const handleDeactivate = () => {
    deactivateMutation.mutate({ employee_id: employeeId, reason: actionReason || undefined }, {
      onSettled: () => { setDeactivateOpen(false); setActionReason('') },
    })
  }

  const handleReactivate = () => {
    reactivateMutation.mutate({ employee_id: employeeId, reason: actionReason || undefined }, {
      onSettled: () => { setReactivateOpen(false); setActionReason('') },
    })
  }

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

  const isDeactivated = !employee.is_active

  return (
    <>
      {isDeactivated && isOwner && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">This employee is deactivated</span>
          </div>
          <div className="flex items-center gap-2">
            {!isOwnProfile && <DeleteEmployeeDialog employee={employee} />}
            <AlertDialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <UserCheck className="mr-2 h-4 w-4" />
                Reactivate
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reactivate Employee</AlertDialogTitle>
                <AlertDialogDescription>
                  This will restore {employee.first_name} {employee.last_name}'s account, set their status to active, and clear their exit date.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                placeholder="Reason (optional)"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
              />
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setActionReason('')}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReactivate} disabled={reactivateMutation.isPending}>
                  {reactivateMutation.isPending ? 'Reactivating...' : 'Confirm Reactivation'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>
        </div>
      )}

      {!isDeactivated && isOwner && (
        <div className="flex justify-end gap-2">
          <ChangeLoginEmailDialog employee={employee} />
          {!isOwnProfile && (
          <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <UserX className="mr-2 h-4 w-4" />
                Deactivate
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deactivate Employee</AlertDialogTitle>
                <AlertDialogDescription>
                  This will revoke {employee.first_name} {employee.last_name}'s access, set them as inactive, and set today as their exit date. Their auth session will be terminated. This can be reversed later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                placeholder="Reason (optional)"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
              />
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setActionReason('')}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeactivate} disabled={deactivateMutation.isPending}>
                  {deactivateMutation.isPending ? 'Deactivating...' : 'Confirm Deactivation'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          )}
        </div>
      )}

      {isDeactivated && !isOwner && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="text-destructive font-medium">This employee is deactivated</span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
      <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0 [&>button]:shrink-0">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
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

      {(isOwnProfile || canViewAll) && (
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
    </Tabs>
    </>
  )
}
