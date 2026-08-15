import type { LeaveBalanceDisplay } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getPLBalanceMetrics, isPrivilegeLeave } from '../utils'

type Props = { balances: LeaveBalanceDisplay[] }

export function LeaveBalanceSummary({ balances }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {balances.map((b) => {
        const color =
          b.available > 0
            ? 'text-green-600'
            : b.available === 0
              ? 'text-yellow-500'
              : 'text-red-600'
        const plMetrics = isPrivilegeLeave(b) ? getPLBalanceMetrics(b) : null
        const used = plMetrics ? plMetrics.used : b.taken + b.pending
        const pendingText = plMetrics ? plMetrics.pending : b.pending
        return (
          <Card key={b.leave_type_id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {b.leave_type.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn('text-3xl font-bold', color)}>
                {b.available}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {plMetrics
                  ? `Used: ${used} · Pending: ${pendingText}`
                  : `Used: ${used} (taken ${b.taken}, pending ${b.pending})`}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
