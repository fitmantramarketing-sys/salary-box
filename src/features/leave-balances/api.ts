import { supabase } from '@/lib/supabase'
import type { LeaveType, LeaveBalance } from '@/types'

export type LeaveBalanceWithType = LeaveBalance & { leave_type: LeaveType | null }

export async function fetchEmployeeBalances(year: number) {
  const [empRes, balRes] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name, employee_code, department:departments!department_id(name)')
      .eq('is_active', true)
      .order('first_name'),
    supabase
      .from('leave_balances')
      .select('*, leave_type:leave_types(*)')
      .eq('year', year),
  ])
  if (empRes.error) throw empRes.error
  if (balRes.error) throw balRes.error
  return { employees: empRes.data ?? [], balances: balRes.data ?? [] }
}

export async function updateLeaveBalance(id: string, updates: { opening_balance?: number; adjusted?: number }) {
  const { error } = await supabase
    .from('leave_balances')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function callYearEndReset(): Promise<{ created: number; year: number }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/year-end-reset`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
  )
  const json = await res.json()
  if (!res.ok) throw json.error
  return json.data
}
