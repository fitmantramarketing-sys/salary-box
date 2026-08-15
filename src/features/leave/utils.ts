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

type LeaveBalanceWithLeaveType = LeaveBalance & {
  leave_type?: { code?: string } | null
}

export function isPrivilegeLeave(balance: LeaveBalanceWithLeaveType): boolean {
  return balance.leave_type?.code === 'PL'
}

export function getPLBalanceMetrics(
  balance: LeaveBalanceWithLeaveType
): { used: number; pending: number } {
  const available = getAvailableBalance(balance)
  return {
    used: Math.max(0, balance.opening_balance - available),
    pending: available,
  }
}

export function getPLRemaining(balance: LeaveBalanceWithLeaveType): number {
  return Math.max(0, getAvailableBalance(balance))
}
