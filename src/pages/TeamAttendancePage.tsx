import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ChevronLeft, ChevronRight, Download, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAttendanceStatusLabel } from '@/features/attendance/utils'
import type { Employee, AttendanceRecord } from '@/types'

type EmployeeWithDept = Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_code'> & {
  department: { name: string } | null
}

async function fetchTeamAttendance(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const [empRes, attRes, holRes] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name, employee_code, department:departments!department_id(name)')
      .eq('is_active', true)
      .order('first_name'),
    supabase
      .from('attendance_records')
      .select('*')
      .gte('date', from)
      .lte('date', to),
    supabase
      .from('holidays')
      .select('date')
      .gte('date', from)
      .lte('date', to),
  ])

  if (empRes.error) throw empRes.error
  if (attRes.error) throw attRes.error
  if (holRes.error) throw holRes.error

  return {
    employees: (empRes.data ?? []) as unknown as EmployeeWithDept[],
    records: (attRes.data ?? []) as AttendanceRecord[],
    holidayDates: new Set((holRes.data ?? []).map((h) => h.date)),
  }
}

const STATUS_CLASSES: Record<string, string> = {
  present: 'bg-green-400',
  absent: 'bg-red-400',
  half_day: 'bg-orange-400',
  work_from_home: 'bg-blue-400',
  on_leave: 'bg-purple-400',
  holiday: 'bg-gray-300',
  weekly_off: 'bg-gray-200',
  incomplete: 'bg-yellow-400',
}

export default function TeamAttendancePage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'team', year, month],
    queryFn: () => fetchTeamAttendance(year, month),
  })

  const daysInMonth = new Date(year, month, 0).getDate()
  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' })

  const recordMap = useMemo(() => {
    const map = new Map<string, Map<string, AttendanceRecord>>()
    if (data) {
      for (const r of data.records) {
        if (!map.has(r.employee_id)) map.set(r.employee_id, new Map())
        map.get(r.employee_id)!.set(r.date, r)
      }
    }
    return map
  }, [data])

  function getSummary(employeeId: string) {
    const empRecords = recordMap.get(employeeId)
    if (!empRecords) return { present: 0, absent: 0, late: 0, wfh: 0, leave: 0 }
    let present = 0, absent = 0, late = 0, wfh = 0, leave = 0
    for (const r of empRecords.values()) {
      if (r.status === 'present') present++
      if (r.status === 'absent') absent++
      if (r.status === 'half_day') present += 0.5
      if (r.status === 'on_leave') leave++
      if (r.is_wfh) wfh++
      if (r.is_late) late++
    }
    return { present, absent, late, wfh, leave }
  }

  function exportCSV() {
    if (!data) return
    const header = ['Employee', 'Code', 'Department', ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1)), 'Present', 'Absent', 'Late', 'WFH']
    const rows = data.employees.map((emp) => {
      const summary = getSummary(emp.id)
      const days = Array.from({ length: daysInMonth }, (_, i) => {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
        const r = recordMap.get(emp.id)?.get(dateStr)
        return r ? getAttendanceStatusLabel(r.status) : '—'
      })
      return [emp.first_name, emp.employee_code, emp.department?.name ?? '', ...days, String(summary.present), String(summary.absent), String(summary.late), String(summary.wfh)]
    })
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team-attendance-${monthName}-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Team Attendance</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else { setMonth(m => m - 1) } }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">{monthName} {year}</span>
          <Button variant="outline" size="icon" onClick={() => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else { setMonth(m => m + 1) } }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="ml-2">
            <Download className="mr-2 h-4 w-4" />CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !data || data.employees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No active employees found.</CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 bg-muted/50 z-10 text-left p-2 font-medium min-w-[140px]">Employee</th>
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <th key={i} className="p-1.5 text-center font-medium w-8 sm:w-10">{i + 1}</th>
                ))}
                <th className="p-1.5 text-center font-medium text-green-600 min-w-[60px]">P</th>
                <th className="p-1.5 text-center font-medium text-red-600 min-w-[60px]">A</th>
                <th className="p-1.5 text-center font-medium text-yellow-600 min-w-[60px]">L</th>
                <th className="p-1.5 text-center font-medium text-blue-600 min-w-[60px]">WFH</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((emp) => {
                const summary = getSummary(emp.id)
                return (
                  <tr key={emp.id} className="border-b hover:bg-accent/30 cursor-pointer" onClick={() => navigate(`/attendance/${emp.id}`)}>
                    <td className="sticky left-0 bg-background z-10 p-2">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="truncate">
                          <p className="font-medium truncate">{emp.first_name} {emp.last_name}</p>
                          <p className="text-[10px] text-muted-foreground">{emp.employee_code} · {emp.department?.name ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
                      const r = recordMap.get(emp.id)?.get(dateStr)
                      const status = r?.status as string | undefined
                      const isHoliday = !status && data?.holidayDates.has(dateStr)
                      return (
                        <td key={i} className="p-1 text-center">
                          {status && status in STATUS_CLASSES ? (
                            <span className={cn('inline-block h-5 w-5 sm:h-6 sm:w-6 rounded-sm', STATUS_CLASSES[status])} title={getAttendanceStatusLabel(status as AttendanceRecord['status'])} />
                          ) : isHoliday ? (
                            <span className={cn('inline-block h-5 w-5 sm:h-6 sm:w-6 rounded-sm', STATUS_CLASSES['holiday'])} title="Holiday" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="p-1.5 text-center font-medium text-green-700">{summary.present}</td>
                    <td className="p-1.5 text-center font-medium text-red-700">{summary.absent}</td>
                    <td className="p-1.5 text-center font-medium text-yellow-700">{summary.late}</td>
                    <td className="p-1.5 text-center font-medium text-blue-700">{summary.wfh}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
