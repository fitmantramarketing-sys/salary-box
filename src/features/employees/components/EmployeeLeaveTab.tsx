import { useEmployeeLeaveBalances } from '@/features/employees/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { getPLBalanceMetrics, getPLRemaining, isPrivilegeLeave } from '@/features/leave/utils'

type Props = { employeeId: string }

export function EmployeeLeaveTab({ employeeId }: Props) {
  const { data: balances, isLoading } = useEmployeeLeaveBalances(employeeId)

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Leave Balances</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!balances?.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Leave Balances</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No leave balances found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Leave Balances — {new Date().getFullYear()}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {balances.map((bal) => {
          const total = bal.opening_balance + bal.accrued + bal.carry_forward_amount + bal.adjusted
          const isPL = isPrivilegeLeave(bal)
          const used = isPL ? getPLBalanceMetrics(bal).used : bal.taken + bal.pending
          const remaining = isPL
            ? getPLRemaining(bal)
            : Math.max(0, total - used)
          const pct = total > 0 ? Math.round((used / total) * 100) : 0

          return (
            <div key={bal.id}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{bal.leave_type.name}</span>
                <span className="text-muted-foreground">
                  {remaining} / {total} remaining
                </span>
              </div>
              <Progress value={pct} className="h-2" />
              {bal.pending > 0 && (
                <p className="mt-0.5 text-xs text-amber-600">{bal.pending} pending approval</p>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
