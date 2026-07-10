import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchEmployeeBalances, updateLeaveBalance, callYearEndReset } from './api'
import { toast } from 'sonner'

export function useEmployeeBalances(year: number) {
  return useQuery({
    queryKey: ['leave-balances', year],
    queryFn: () => fetchEmployeeBalances(year),
  })
}

export function useUpdateLeaveBalance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; opening_balance?: number; adjusted?: number; annual_allocation?: number }) =>
      updateLeaveBalance(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-balances'] })
      toast.success('Leave balance updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useYearEndReset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: callYearEndReset,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['leave-balances'] })
      toast.success(`Year-end reset complete: ${data.created} balances created for year ${data.year}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
