import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { callEdgeFunction, callEdgeFunctionFormData } from '@/lib/edge'
import type { CreateEmployeeResponse, UploadDocumentResponse, AddLifecycleEventResponse, DeactivateEmployeeResponse, ReactivateEmployeeResponse } from '@/types'
import type { CreateEmployeeForm } from './schemas'
import type { LifecycleEventForm } from './types'
import type { Employee } from '@/types'

export function useSubmitProfileEdit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { employee_id: string; requested_changes: Record<string, string> }) => {
      const { error } = await supabase.from('profile_edit_requests').insert({
        employee_id: body.employee_id,
        requested_changes: body.requested_changes,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile-edit-requests'] })
    },
  })
}

export function useReviewProfileEdit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { request_id: string; action: 'approve' | 'reject'; reviewer_notes?: string }) =>
      callEdgeFunction<{ request_id: string; action: 'approve' | 'reject'; reviewer_notes?: string }, { reviewed: boolean }>('review-profile-edit', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile-edit-requests'] })
      qc.invalidateQueries({ queryKey: ['employees', 'list'] })
      qc.invalidateQueries({ queryKey: ['employees', 'detail'] })
    },
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateEmployeeForm) =>
      callEdgeFunction<CreateEmployeeForm, CreateEmployeeResponse>('create-employee', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees', 'list'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUploadDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData: FormData) =>
      callEdgeFunctionFormData<UploadDocumentResponse>('upload-document', formData),
    onSuccess: (_data, variables) => {
      const employeeId = variables.get('employee_id') as string
      qc.invalidateQueries({ queryKey: ['employees', 'documents', employeeId] })
      qc.invalidateQueries({ queryKey: ['employees', 'detail', employeeId] })
    },
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ document_id, employee_id }: { document_id: string; employee_id: string }) => {
      const { error } = await supabase
        .from('employee_documents')
        .update({ is_active: false })
        .eq('id', document_id)
      if (error) throw error
      return employee_id
    },
    onSuccess: (employeeId) => {
      qc.invalidateQueries({ queryKey: ['employees', 'documents', employeeId] })
    },
  })
}

export function useAddLifecycleEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: LifecycleEventForm) =>
      callEdgeFunction<LifecycleEventForm, AddLifecycleEventResponse>('add-lifecycle-event', body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['employees', 'lifecycle', variables.employee_id] })
      qc.invalidateQueries({ queryKey: ['employees', 'detail', variables.employee_id] })
    },
  })
}

export function useBulkImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData: FormData) =>
      callEdgeFunctionFormData<{ total_rows: number; success_count: number; failure_count: number; failures: { row: number; error: string }[] }>('bulk-import-employees', formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees', 'list'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

type UpdateEmployeeFields = Partial<Omit<Employee, 'id' | 'created_at' | 'updated_at'>>

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ employee_id, ...updates }: { employee_id: string } & UpdateEmployeeFields) =>
      callEdgeFunction<{ employee_id: string } & UpdateEmployeeFields, { id: string }>('update-employee', {
        employee_id,
        ...updates,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['employees', 'detail', variables.employee_id] })
      qc.invalidateQueries({ queryKey: ['employees', 'list'] })
    },
  })
}

export type BulkImportResult = {
  total_rows: number
  success_count: number
  failure_count: number
  failures: { row: number; error: string }[]
}

export function useDeactivateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { employee_id: string; reason?: string }) =>
      callEdgeFunction<{ employee_id: string; reason?: string }, DeactivateEmployeeResponse>('deactivate-employee', body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['employees', 'detail', variables.employee_id] })
      qc.invalidateQueries({ queryKey: ['employees', 'list'] })
    },
  })
}

export function useReactivateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { employee_id: string; reason?: string }) =>
      callEdgeFunction<{ employee_id: string; reason?: string }, ReactivateEmployeeResponse>('reactivate-employee', body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['employees', 'detail', variables.employee_id] })
      qc.invalidateQueries({ queryKey: ['employees', 'list'] })
    },
  })
}

export function useChangeLoginEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { employee_id: string; new_email: string }) =>
      callEdgeFunction<{ employee_id: string; new_email: string }, { employee_id: string; email: string }>(
        'change-login-email',
        body
      ),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['employees', 'detail', variables.employee_id] })
      qc.invalidateQueries({ queryKey: ['employees', 'list'] })
    },
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { employee_id: string; confirmation: string }) =>
      callEdgeFunction<{ employee_id: string; confirmation: string }, { deleted: boolean }>(
        'delete-employee',
        body
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees', 'list'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
