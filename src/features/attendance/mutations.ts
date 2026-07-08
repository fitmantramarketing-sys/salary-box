import { useMutation, useQueryClient } from '@tanstack/react-query'
import { callEdgeFunction } from '@/lib/edge'
import type { CheckInResponse, CheckOutResponse } from '@/types'
import type { SubmitRegularizationForm } from './schemas'

export function useCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (coords?: { latitude?: number; longitude?: number }) =>
      callEdgeFunction<object, CheckInResponse>('check-in', coords ?? {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  })
}

export function useCheckOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      callEdgeFunction<object, CheckOutResponse>('check-out', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  })
}

export function useLogWFH() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      callEdgeFunction<object, { attendance_record_id: string; is_wfh: boolean }>('log-wfh', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  })
}

export function useSubmitRegularization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SubmitRegularizationForm) =>
      callEdgeFunction<SubmitRegularizationForm, { request_id: string; status: string }>(
        'submit-regularization',
        body
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  })
}

export function useWithdrawRegularization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (request_id: string) =>
      callEdgeFunction<{ request_id: string }, { request_id: string; status: string }>(
        'withdraw-regularization',
        { request_id }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  })
}
