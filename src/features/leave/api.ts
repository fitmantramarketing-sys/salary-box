import { supabase } from '@/lib/supabase'
import type { LeaveBalance, LeaveType, LeaveApplicationWithRelations, Holiday } from '@/types'

export async function fetchLeaveTypes(): Promise<LeaveType[]> {
  const { data, error } = await supabase
    .from('leave_types')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchMyLeaveBalances(
  employeeId: string,
  year: number
): Promise<(LeaveBalance & { leave_type: LeaveType })[]> {
  const { data, error } = await supabase
    .from('leave_balances')
    .select('*, leave_type:leave_types(*)')
    .eq('employee_id', employeeId)
    .eq('year', year)
  if (error) throw error
  return data ?? []
}

export async function fetchMyLeaveApplications(
  employeeId: string
): Promise<LeaveApplicationWithRelations[]> {
  const { data, error } = await supabase
    .from('leave_applications')
    .select('*, leave_type:leave_types(*)')
    .eq('employee_id', employeeId)
    .order('applied_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as LeaveApplicationWithRelations[]
}

export async function fetchPendingLeaveApplications(): Promise<LeaveApplicationWithRelations[]> {
  const { data, error } = await supabase
    .from('leave_applications')
    .select('*, leave_type:leave_types(*), employee:employees!leave_applications_employee_id_fkey(id, first_name, last_name, employee_code)')
    .eq('status', 'pending')
    .order('applied_at')
  if (error) throw error
  return (data ?? []) as unknown as LeaveApplicationWithRelations[]
}

export async function fetchCancellationRequests(): Promise<LeaveApplicationWithRelations[]> {
  const { data, error } = await supabase
    .from('leave_applications')
    .select('*, leave_type:leave_types(*), employee:employees!leave_applications_employee_id_fkey(id, first_name, last_name, employee_code)')
    .eq('cancellation_requested', true)
    .order('applied_at')
  if (error) throw error
  return (data ?? []) as unknown as LeaveApplicationWithRelations[]
}

export async function fetchLeaveApplication(id: string): Promise<LeaveApplicationWithRelations> {
  const { data, error } = await supabase
    .from('leave_applications')
    .select('*, leave_type:leave_types(*), employee:employees!leave_applications_employee_id_fkey(id, first_name, last_name, employee_code)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as LeaveApplicationWithRelations
}
export async function fetchHolidays(year?: number): Promise<Holiday[]> {
  let query = supabase
    .from('holidays')
    .select('*')
    .order('date')
  if (year) query = query.eq('year', year)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchMyOptionalHolidays(employeeId: string): Promise<{ holiday_id: string }[]> {
  const { data, error } = await supabase
    .from('employee_optional_holidays')
    .select('holiday_id')
    .eq('employee_id', employeeId)
  if (error) throw error
  return data ?? []
}


