import type { LeaveApplication, LeaveBalance } from '@/types'

export function getLeaveStatusLabel(status: LeaveApplication['status']): string {
  const labels: Record<LeaveApplication['status'], string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  }
  return labels[status] ?? status
}

export function getAvailableBalance(balance: LeaveBalance): number {
  return (
    balance.opening_balance +
    balance.adjusted -
    balance.taken -
    balance.pending
  )
}
