import { useRole } from '@/hooks/useRole'
import { useMyLeaveBalances } from '@/features/leave/hooks'
import { LeaveBalanceSummary } from '@/features/leave/components/LeaveBalanceSummary'
import { LeaveBalanceReport } from '@/features/leave/components/LeaveBalanceReport'
import { getAvailableBalance } from '@/features/leave/utils'
import type { LeaveBalanceDisplay } from '@/features/leave/types'
import { Skeleton } from '@/components/ui/skeleton'

export default function ReportsLeavePage() {
  const { isEmployee } = useRole()
  const year = new Date().getFullYear()
  const { data: balances, isLoading } = useMyLeaveBalances(year)

  if (isEmployee) {
    const displayBalances: LeaveBalanceDisplay[] = (balances ?? []).map((b) => ({
      ...b,
      available: getAvailableBalance(b),
    }))

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Leave Balances</h1>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <LeaveBalanceSummary balances={displayBalances} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Leave Balance Report</h1>
      <LeaveBalanceReport />
    </div>
  )
}
