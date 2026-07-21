import { useEmployeeAttendanceCurrentMonth } from '@/features/employees/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type Props = { employeeId: string }

export function EmployeeAttendanceTab({ employeeId }: Props) {
  const { data: records, isLoading } = useEmployeeAttendanceCurrentMonth(employeeId)

  const present = records?.filter((r) => r.status === 'present').length ?? 0
  const absent = records?.filter((r) => r.status === 'absent').length ?? 0
  const late = records?.filter((r) => r.is_late).length ?? 0
  const wfh = records?.filter((r) => r.is_wfh).length ?? 0
  const onLeave = records?.filter((r) => r.status === 'on_leave').length ?? 0

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Attendance</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Attendance — This Month</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border bg-green-50 p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{present}</p>
            <p className="text-xs text-green-600">Present</p>
          </div>
          <div className="rounded-lg border bg-rose-50 p-3 text-center">
            <p className="text-2xl font-bold text-rose-700">{absent}</p>
            <p className="text-xs text-rose-600">Absent</p>
          </div>
          <div className="rounded-lg border bg-yellow-50 p-3 text-center">
            <p className="text-2xl font-bold text-yellow-700">{late}</p>
            <p className="text-xs text-yellow-600">Late</p>
          </div>
          <div className="rounded-lg border bg-blue-50 p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{wfh}</p>
            <p className="text-xs text-blue-600">WFH</p>
          </div>
        </div>
        {onLeave > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">{onLeave} day(s) on leave</p>
        )}
      </CardContent>
    </Card>
  )
}
