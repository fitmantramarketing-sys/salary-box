import { supabase } from '@/lib/supabase'
import type { AttendanceRecord } from '@/types'

export type AttendanceReportRow = {
  employeeId: string
  employeeName: string
  employeeCode: string
  departmentName: string | null
  presentDays: number
  wfhDays: number
  absentDays: number
  onLeaveDays: number
  halfDayDays: number
  lateMarks: number
  overtimeHours: number
}

export type HeatmapRow = {
  departmentId: string
  departmentName: string
  dayAttendance: { day: number; present: number; total: number; pct: number }[]
}

export type HeadcountRow = {
  id: string
  name: string
  employeeCode: string
  departmentName: string | null
  designationName: string | null
  employmentType: string
  employmentStatus: string
  joinDate: string
  exitDate: string | null
}

export type RegularizationReportRow = {
  id: string
  employeeName: string
  employeeCode: string
  date: string
  requestedStatus: string
  reason: string
  status: string
  reviewerName: string | null
  reviewerComment: string | null
  createdAt: string
}

export type SelfAttendanceRow = {
  date: string
  dayOfWeek: number
  status: string
  checkIn: string | null
  checkOut: string | null
  totalHours: number | null
  isLate: boolean
  isWfh: boolean
}

function monthBounds(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to, daysInMonth: lastDay }
}

export async function fetchDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchAttendanceReport(
  year: number,
  month: number,
  departmentId?: string
): Promise<AttendanceReportRow[]> {
  const { from, to } = monthBounds(year, month)

  let empQuery = supabase
    .from('employees')
    .select('id, first_name, last_name, employee_code, department:departments!department_id(name)')
    .eq('is_active', true)
    .neq('role', 'owner')
    .order('first_name')

  if (departmentId) {
    empQuery = empQuery.eq('department_id', departmentId)
  }

  const [empRes, attRes] = await Promise.all([
    empQuery,
    supabase
      .from('attendance_records')
      .select('*')
      .gte('date', from)
      .lte('date', to),
  ])

  if (empRes.error) throw empRes.error
  if (attRes.error) throw attRes.error

  const employees = empRes.data ?? []
  const records = attRes.data ?? []

  const recordMap = new Map<string, AttendanceRecord[]>()
  for (const r of records) {
    const arr = recordMap.get(r.employee_id) ?? []
    arr.push(r)
    recordMap.set(r.employee_id, arr)
  }

  return employees.map((emp) => {
    const empRecords = recordMap.get(emp.id) ?? []
    const dept = emp.department as { name: string } | null
    return {
      employeeId: emp.id,
      employeeName: `${emp.first_name} ${emp.last_name}`,
      employeeCode: emp.employee_code,
      departmentName: dept?.name ?? null,
      presentDays: empRecords.filter((r) => r.status === 'present').length,
      wfhDays: empRecords.filter((r) => r.status === 'work_from_home' || r.is_wfh).length,
      absentDays: empRecords.filter((r) => r.status === 'absent').length,
      onLeaveDays: empRecords.filter((r) => r.status === 'on_leave').length,
      halfDayDays: empRecords.filter((r) => r.status === 'half_day').length,
      lateMarks: empRecords.filter((r) => r.is_late).length,
      overtimeHours: empRecords.reduce((sum, r) => sum + (r.overtime_hours ?? 0), 0),
    }
  })
}

export async function fetchHeatmapData(
  year: number,
  month: number,
  departmentIds?: string[]
): Promise<HeatmapRow[]> {
  const { from, to, daysInMonth } = monthBounds(year, month)

  let deptQuery = supabase
    .from('departments')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (departmentIds && departmentIds.length > 0) {
    deptQuery = deptQuery.in('id', departmentIds)
  }

  const [deptRes, empRes, attRes] = await Promise.all([
    deptQuery,
    supabase
      .from('employees')
      .select('id, department_id')
      .eq('is_active', true)
      .neq('role', 'owner'),
    supabase
      .from('attendance_records')
      .select('employee_id, date, status')
      .gte('date', from)
      .lte('date', to),
  ])

  if (deptRes.error) throw deptRes.error
  if (empRes.error) throw empRes.error
  if (attRes.error) throw attRes.error

  const departments = deptRes.data ?? []
  const employees = empRes.data ?? []
  const records = attRes.data ?? []

  const deptEmployeeMap = new Map<string, string[]>()
  for (const emp of employees) {
    if (!emp.department_id) continue
    const arr = deptEmployeeMap.get(emp.department_id) ?? []
    arr.push(emp.id)
    deptEmployeeMap.set(emp.department_id, arr)
  }

  const dayRecordMap = new Map<string, Set<string>>()
  for (const r of records) {
    if (r.status === 'present' || r.status === 'work_from_home' || r.status === 'half_day') {
      const set = dayRecordMap.get(r.date) ?? new Set()
      set.add(r.employee_id)
      dayRecordMap.set(r.date, set)
    }
  }

  const presentStatuses = new Set(['present', 'work_from_home', 'half_day'])

  return departments.map((dept) => {
    const deptEmployees = deptEmployeeMap.get(dept.id) ?? []
    const deptEmployeeCount = deptEmployees.length

    const dayAttendance = Array.from({ length: daysInMonth }, (_, i) => {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
      const presentInDept = records.filter(
        (r) => presentStatuses.has(r.status) && r.date === dateStr && deptEmployees.includes(r.employee_id)
      ).length
      return {
        day: i + 1,
        present: presentInDept,
        total: deptEmployeeCount,
        pct: deptEmployeeCount > 0 ? Math.round((presentInDept / deptEmployeeCount) * 100) : 0,
      }
    })

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      dayAttendance,
    }
  })
}

export async function fetchHeadcountReport(
  departmentId?: string,
  employmentStatus?: string,
  employmentType?: string
): Promise<HeadcountRow[]> {
  let query = supabase
    .from('employees')
    .select('id, first_name, last_name, employee_code, join_date, exit_date, employment_type, employment_status, department:departments!department_id(name), designation:designations!designation_id(name)')
    .order('first_name')

  if (departmentId) query = query.eq('department_id', departmentId)
  if (employmentStatus) query = query.eq('employment_status', employmentStatus as 'active' | 'on_probation' | 'resigned' | 'terminated' | 'on_leave')
  if (employmentType) query = query.eq('employment_type', employmentType as 'full_time' | 'part_time' | 'contractor' | 'intern')

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((emp) => {
    const dept = emp.department as { name: string } | null
    const desig = emp.designation as { name: string } | null
    return {
      id: emp.id,
      name: `${emp.first_name} ${emp.last_name}`,
      employeeCode: emp.employee_code,
      departmentName: dept?.name ?? null,
      designationName: desig?.name ?? null,
      employmentType: emp.employment_type,
      employmentStatus: emp.employment_status,
      joinDate: emp.join_date,
      exitDate: emp.exit_date,
    }
  })
}

export async function fetchRegularizationLog(
  dateFrom?: string,
  dateTo?: string,
  departmentId?: string,
  status?: string
): Promise<RegularizationReportRow[]> {
  let query = supabase
    .from('attendance_regularization_requests')
    .select('*, attendance_record:attendance_records!attendance_record_id(date), employee:employees!employee_id(first_name, last_name, employee_code, department_id), reviewer:employees!reviewed_by(first_name, last_name)')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status as 'pending' | 'approved' | 'rejected')

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []).map((req: Record<string, unknown>) => {
    const att = req.attendance_record as { date: string } | null
    const emp = req.employee as { first_name: string; last_name: string; employee_code: string; department_id: string } | null
    const reviewer = req.reviewer as { first_name: string; last_name: string } | null
    return {
      id: req.id as string,
      employeeName: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
      employeeCode: emp?.employee_code ?? '—',
      date: att?.date ?? '—',
      requestedStatus: req.requested_status as string,
      reason: req.reason as string,
      status: req.status as string,
      reviewerName: reviewer ? `${reviewer.first_name} ${reviewer.last_name}` : null,
      reviewerComment: req.reviewer_comment as string | null,
      createdAt: req.created_at as string,
      departmentId: emp?.department_id ?? null,
    }
  })

  let filtered = rows
  if (dateFrom) filtered = filtered.filter((r) => r.date >= dateFrom)
  if (dateTo) filtered = filtered.filter((r) => r.date <= dateTo)
  if (departmentId) filtered = filtered.filter((r) => r.departmentId === departmentId)

  return filtered
}

export type DailyAttendanceRow = {
  employeeId: string
  employeeName: string
  employeeCode: string
  departmentName: string | null
  checkIn: string | null
  checkOut: string | null
  totalHours: number | null
  isLate: boolean
  isWfh: boolean
  status: string
}

export async function fetchDailyAttendance(date: string): Promise<DailyAttendanceRow[]> {
  const [empRes, attRes, holRes, shiftRes] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name, employee_code, department:departments!department_id(name)')
      .eq('is_active', true)
      .neq('role', 'owner')
      .order('first_name'),
    supabase
      .from('attendance_records')
      .select('*')
      .eq('date', date),
    supabase
      .from('holidays')
      .select('date')
      .eq('date', date),
    supabase
      .from('shifts')
      .select('weekly_off_days')
      .eq('is_default', true)
      .limit(1),
  ])

  if (empRes.error) throw empRes.error
  if (attRes.error) throw attRes.error
  if (holRes.error) throw holRes.error

  const employees = empRes.data ?? []
  const records = attRes.data ?? []
  const isHoliday = (holRes.data ?? []).length > 0
  const weeklyOffDays = new Set<number>((shiftRes.data?.[0]?.weekly_off_days as number[] | undefined) ?? [0])
  const dayOfWeek = new Date(date).getDay()
  const isWeeklyOff = !isHoliday && weeklyOffDays.has(dayOfWeek)

  const recordMap = new Map<string, typeof records[0]>()
  for (const r of records) {
    recordMap.set(r.employee_id, r)
  }

  return employees.map((emp) => {
    const dept = emp.department as { name: string } | null
    const rec = recordMap.get(emp.id)

    let status = rec?.status ?? 'absent'
    if (!rec) {
      if (isHoliday) status = 'holiday'
      else if (isWeeklyOff) status = 'weekly_off'
    }

    return {
      employeeId: emp.id,
      employeeName: `${emp.first_name} ${emp.last_name}`,
      employeeCode: emp.employee_code,
      departmentName: dept?.name ?? null,
      checkIn: rec?.check_in_time ?? null,
      checkOut: rec?.check_out_time ?? null,
      totalHours: rec?.total_hours ?? null,
      isLate: rec?.is_late ?? false,
      isWfh: rec?.is_wfh ?? false,
      status,
    }
  })
}

export type AbsenteeismRow = {
  employeeId: string
  employeeName: string
  employeeCode: string
  departmentName: string | null
  absentDays: number
  totalWorkDays: number
  absenceRate: number
}

export async function fetchAbsenteeismData(
  year: number,
  month: number,
  departmentId?: string
): Promise<AbsenteeismRow[]> {
  const { from, to } = monthBounds(year, month)

  let empQuery = supabase
    .from('employees')
    .select('id, first_name, last_name, employee_code, department:departments!department_id(name)')
    .eq('is_active', true)
    .order('first_name')

  if (departmentId) {
    empQuery = empQuery.eq('department_id', departmentId)
  }

  const [empRes, attRes] = await Promise.all([
    empQuery,
    supabase
      .from('attendance_records')
      .select('employee_id, status')
      .gte('date', from)
      .lte('date', to),
  ])

  if (empRes.error) throw empRes.error
  if (attRes.error) throw attRes.error

  const employees = empRes.data ?? []
  const records = attRes.data ?? []

  const lastDay = new Date(year, month, 0).getDate()
  let workdayCount = 0
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow !== 0) workdayCount++
  }

  const recordMap = new Map<string, { absent: number }>()
  for (const r of records) {
    if (r.status === 'absent') {
      const entry = recordMap.get(r.employee_id) ?? { absent: 0 }
      entry.absent++
      recordMap.set(r.employee_id, entry)
    }
  }

  return employees
    .map((emp) => {
      const dept = emp.department as { name: string } | null
      const stats = recordMap.get(emp.id) ?? { absent: 0 }
      return {
        employeeId: emp.id,
        employeeName: `${emp.first_name} ${emp.last_name}`,
        employeeCode: emp.employee_code,
        departmentName: dept?.name ?? null,
        absentDays: stats.absent,
        totalWorkDays: workdayCount,
        absenceRate: workdayCount > 0 ? Math.round((stats.absent / workdayCount) * 100) : 0,
      }
    })
    .filter((r) => r.absentDays > 0)
    .sort((a, b) => b.absenceRate - a.absenceRate)
}

export async function fetchSelfAttendance(
  employeeId: string,
  year: number,
  month: number
): Promise<SelfAttendanceRow[]> {
  const { from, to } = monthBounds(year, month)

  const [attRes, holRes, shiftRes] = await Promise.all([
    supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', from)
      .lte('date', to)
      .order('date'),
    supabase
      .from('holidays')
      .select('date')
      .gte('date', from)
      .lte('date', to),
    supabase
      .from('shifts')
      .select('weekly_off_days')
      .eq('is_default', true)
      .limit(1),
  ])

  if (attRes.error) throw attRes.error
  if (holRes.error) throw holRes.error

  const records = attRes.data ?? []
  const holidayDates = new Set((holRes.data ?? []).map((h) => h.date))
  const recordMap = new Map(records.map((r) => [r.date, r]))
  const weeklyOffDays = new Set<number>((shiftRes.data?.[0]?.weekly_off_days as number[] | undefined) ?? [0])

  const { daysInMonth } = monthBounds(year, month)

  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const record = recordMap.get(dateStr)
    const isHoliday = holidayDates.has(dateStr)
    const isWeeklyOff = !isHoliday && weeklyOffDays.has(new Date(dateStr).getDay())
    return {
      date: dateStr,
      dayOfWeek: new Date(dateStr).getDay(),
      status: record?.status ?? (isHoliday ? 'holiday' : (isWeeklyOff ? 'weekly_off' : 'absent')),
      checkIn: record?.check_in_time ?? null,
      checkOut: record?.check_out_time ?? null,
      totalHours: record?.total_hours ?? null,
      isLate: record?.is_late ?? false,
      isWfh: record?.is_wfh ?? false,
    }
  })
}
