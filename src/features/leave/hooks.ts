import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/hooks/useAuth'
import {
  fetchLeaveTypes,
  fetchMyLeaveBalances,
  fetchMyLeaveApplications,
  fetchPendingLeaveApplications,
  fetchCancellationRequests,
  fetchLeaveApplication,
  fetchHolidays,
  fetchMyOptionalHolidays,
} from './api'

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave', 'types'],
    queryFn: fetchLeaveTypes,
  })
}

export function useMyLeaveBalances(year: number) {
  const employeeId = useAuthStore((s) => s.employee?.id)
  return useQuery({
    queryKey: ['leave', 'balances', employeeId, year],
    queryFn: () => fetchMyLeaveBalances(employeeId!, year),
    enabled: !!employeeId,
  })
}

export function useMyLeaveApplications() {
  const employeeId = useAuthStore((s) => s.employee?.id)
  return useQuery({
    queryKey: ['leave', 'applications', employeeId],
    queryFn: () => fetchMyLeaveApplications(employeeId!),
    enabled: !!employeeId,
  })
}

export function usePendingLeaveApplications() {
  return useQuery({
    queryKey: ['leave', 'applications', 'pending'],
    queryFn: fetchPendingLeaveApplications,
  })
}

export function useCancellationRequests() {
  return useQuery({
    queryKey: ['leave', 'cancellations'],
    queryFn: fetchCancellationRequests,
  })
}

export function useLeaveApplication(id: string) {
  return useQuery({
    queryKey: ['leave', 'applications', 'detail', id],
    queryFn: () => fetchLeaveApplication(id),
    enabled: !!id,
  })
}
export function useHolidays(year?: number) {
  return useQuery({
    queryKey: ['leave', 'holidays', year],
    queryFn: () => fetchHolidays(year),
  })
}

export function useMyOptionalHolidays() {
  const employeeId = useAuthStore((s) => s.employee?.id)
  return useQuery({
    queryKey: ['leave', 'optional-holidays', employeeId],
    queryFn: () => fetchMyOptionalHolidays(employeeId!),
    enabled: !!employeeId,
  })
}
