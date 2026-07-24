import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { LeaveApplication, Employee } from '@/types'

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(getDaysInMonth(year, month)).padStart(2, '0')}`
  return { start, end }
}

function expandDateRange(from: string, to: string): string[] {
  const days: string[] = []
  const d = new Date(from)
  const end = new Date(to)
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return days
}

const statusColor: Record<string, string> = {
  approved: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
}

export function TeamLeaveCalendar() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const [employees, setEmployees] = useState<Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_code'>[]>([])
  const [applications, setApplications] = useState<(LeaveApplication & { leave_type: { name: string } })[]>([])
  const [loading, setLoading] = useState(true)

  const daysInMonth = getDaysInMonth(year, month)
  const range = getMonthRange(year, month)

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      setLoading(true)
      try {
        const [empRes, appRes] = await Promise.all([
          supabase
            .from('employees')
            .select('id, first_name, last_name, employee_code')
            .eq('is_active', true)
            .order('first_name'),
          supabase
            .from('leave_applications')
            .select('*, leave_type:leave_types(name)')
            .gte('to_date', range.start)
            .lte('from_date', range.end),
        ])
        if (cancelled) return
        setEmployees(empRes.data ?? [])
        setApplications(appRes.data ?? [])
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [year, month])

  const leaveMap = useMemo(() => {
    const map = new Map<string, Map<number, { status: string; typeName: string; id: string }>>()
    for (const app of applications) {
      const days = expandDateRange(app.from_date, app.to_date)
      for (const dayStr of days) {
        const dayNum = new Date(dayStr).getDate()
        if (!map.has(app.employee_id)) {
          map.set(app.employee_id, new Map())
        }
        const empMap = map.get(app.employee_id)!
        empMap.set(dayNum, { status: app.status, typeName: app.leave_type?.name ?? '', id: app.id })
      }
    }
    return map
  }, [applications])

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Leave Calendar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Team Leave Calendar</CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={prevMonth}>&larr;</Button>
          <span className="text-sm font-medium w-32 text-center">
            {monthNames[month]} {year}
          </span>
          <Button size="sm" variant="outline" onClick={nextMonth}>&rarr;</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-w-full">
          <div className="min-w-[600px]">
            <div className="grid gap-0" style={{ gridTemplateColumns: `200px repeat(${daysInMonth}, 32px) 80px` }}>
              <div className="sticky left-0 bg-background z-10 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                Team Member
              </div>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'text-center text-xs py-2 border-b',
                    i + 1 === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                      ? 'bg-primary/10 font-bold'
                      : 'text-muted-foreground'
                  )}
                >
                  {i + 1}
                </div>
              ))}
              <div className="px-2 py-2 text-xs font-medium text-muted-foreground border-b text-center">
                Total
              </div>

              {employees.map((emp) => {
                const empLeaves = leaveMap.get(emp.id)
                let totalDays = 0
                return (
                  <>
                    <div className="sticky left-0 bg-background z-10 px-3 py-1.5 text-sm border-b truncate flex items-center gap-1">
                      <span className="font-medium truncate">
                        {emp.first_name} {emp.last_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {emp.employee_code}
                      </span>
                    </div>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1
                      const leave = empLeaves?.get(day)
                      if (leave) totalDays++
                      return (
                        <div
                          key={day}
                          className={cn(
                            'border-b border-r text-center py-1.5 text-xs',
                            leave ? statusColor[leave.status] ?? '' : ''
                          )}
                          title={leave ? `${leave.typeName} (${leave.status})` : undefined}
                        >
                          {leave ? leave.status[0].toUpperCase() : ''}
                        </div>
                      )
                    })}
                    <div className="border-b text-center py-1.5 text-sm font-medium">
                      {totalDays}
                    </div>
                  </>
                )
              })}
            </div>

            <div className="flex items-center gap-4 px-3 py-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-blue-100" /> Approved
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-yellow-100" /> Pending
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-red-100" /> Rejected
              </span>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
