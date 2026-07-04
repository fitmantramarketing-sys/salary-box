import { getServiceClient } from './supabase.ts'

export type ShiftInfo = {
  id: string
  name: string
  start_time: string
  end_time: string
  saturday_start_time: string | null
  saturday_end_time: string | null
  total_hours: number
  weekly_off_days: number[]
  late_mark_threshold: number
  grace_period_minutes: number
  break_minutes: number
  is_night_shift: boolean
}

export function getDayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function getEffectiveTimes(shift: ShiftInfo, date: string): { start_time: string; end_time: string } {
  if (getDayOfWeek(date) === 6 && shift.saturday_start_time && shift.saturday_end_time) {
    return { start_time: shift.saturday_start_time, end_time: shift.saturday_end_time }
  }
  return { start_time: shift.start_time, end_time: shift.end_time }
}

export async function resolveShift(employeeId: string, date: string): Promise<ShiftInfo> {
  const supabase = getServiceClient()

  // 1. Employee-level override
  const { data: override } = await supabase
    .from('employee_shift_overrides')
    .select('shifts(*)')
    .eq('employee_id', employeeId)
    .lte('effective_from', date)
    .or(`effective_to.is.null,effective_to.gte.${date}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (override?.shifts) return override.shifts as unknown as ShiftInfo

  // 2. Department shift
  const { data: emp } = await supabase
    .from('employees')
    .select('department_id')
    .eq('id', employeeId)
    .single()

  if (emp?.department_id) {
    const { data: deptShift } = await supabase
      .from('department_shifts')
      .select('shifts(*)')
      .eq('department_id', emp.department_id)
      .limit(1)
      .maybeSingle()

    if (deptShift?.shifts) return deptShift.shifts as unknown as ShiftInfo
  }

  // 3. Default shift
  const { data: defaultShift, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('is_default', true)
    .single()

  if (error || !defaultShift) {
    throw { code: 'NOT_FOUND', message: 'No shift found for employee and no default configured', status: 404 }
  }

  return defaultShift as unknown as ShiftInfo
}
