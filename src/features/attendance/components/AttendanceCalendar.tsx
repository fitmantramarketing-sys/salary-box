import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { AttendanceRecord } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatHours, getAttendanceStatusLabel } from '../utils'
import type { AttendanceStatus } from '../types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

type Props = {
  records: AttendanceRecord[] | undefined
  year: number
  month: number
  onPrevMonth: () => void
  onNextMonth: () => void
  onManualEntry?: (date: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-500 hover:bg-green-600',
  absent: 'bg-red-500 hover:bg-red-600',
  half_day: 'bg-orange-400 hover:bg-orange-500',
  late: 'bg-green-500 hover:bg-green-600',
  work_from_home: 'bg-blue-500 hover:bg-blue-600',
  on_leave: 'bg-purple-500 hover:bg-purple-600',
  holiday: 'bg-gray-300 hover:bg-gray-400',
  weekly_off: 'bg-gray-200 hover:bg-gray-300',
  incomplete: 'bg-yellow-400 hover:bg-yellow-500',
}

export function AttendanceCalendar({ records, year, month, onPrevMonth, onNextMonth, onManualEntry }: Props) {
  const [selectedDay, setSelectedDay] = useState<AttendanceRecord | null>(null)
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set())
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([0])

  useEffect(() => {
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    supabase.from('holidays').select('date').gte('date', from).lte('date', to).then(({ data }) => {
      setHolidayDates(new Set((data ?? []).map((h) => h.date)))
    })
    supabase.from('shifts').select('weekly_off_days').eq('is_default', true).limit(1).then(({ data }) => {
      if (data && data.length > 0) setWeeklyOffDays(data[0].weekly_off_days)
    })
  }, [year, month])

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' })

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>()
    if (records) {
      for (const r of records) {
        map.set(r.date, r)
      }
    }
    return map
  }, [records])

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-sm sm:text-base">
            <span className="truncate">{monthName} {year}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={onPrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 border rounded-md overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="border-b border-r bg-muted/50 px-1 py-1.5 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="border-b border-r aspect-square" />
            ))}
            {days.map((day) => {
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const record = recordMap.get(dateStr)
              const rawStatus = record?.status as string | undefined
              const dayOfWeek = new Date(year, month - 1, day).getDay()
              const isHoliday = !rawStatus && holidayDates.has(dateStr)
              const isWeeklyOff = !rawStatus && !isHoliday && weeklyOffDays.includes(dayOfWeek)
              const status = isWeeklyOff ? 'weekly_off' : (isHoliday ? 'holiday' : (rawStatus ?? null))

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(record ?? {
                    id: '',
                    employee_id: '',
                    date: dateStr,
                    shift_id: null,
                    check_in_time: null,
                    check_out_time: null,
                    check_in_ip: null,
                    check_in_lat: null,
                    check_in_lng: null,
                    check_out_lat: null,
                    check_out_lng: null,
                    is_geo_flagged: false,
                    is_wfh: false,
                    status: 'absent',
                    total_hours: null,
                    overtime_hours: null,
                    overtime_approved: null,
                    overtime_approved_by: null,
                    is_late: false,
                    is_manually_entered: false,
                    manual_entry_reason: null,
                    manual_entry_by: null,
                    created_at: '',
                    updated_at: '',
                  } as AttendanceRecord)}
                  className={cn(
                    'aspect-square border-b border-r flex items-center justify-center text-xs font-medium transition-colors',
                    status ? STATUS_COLORS[status] : 'hover:bg-accent'
                  )}
                  title={status ? getAttendanceStatusLabel(status as AttendanceStatus) : dateStr}
                >
                  <span className="text-foreground">
                    {day}
                  </span>
                </button>
              )
            })}
            {Array.from({ length: (7 - (firstDayOfWeek + daysInMonth) % 7) % 7 }).map((_, i) => (
              <div key={`trailing-${i}`} className="border-b border-r aspect-square" />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {(Object.keys(STATUS_COLORS) as AttendanceStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`inline-block h-3 w-3 rounded ${STATUS_COLORS[s].split(' ')[0]}`} />
                {getAttendanceStatusLabel(s)}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDay} onOpenChange={(open) => { if (!open) setSelectedDay(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDay?.date}</DialogTitle>
            <DialogDescription>
              Status: <strong>{selectedDay ? getAttendanceStatusLabel(selectedDay.status) : ''}</strong>
            </DialogDescription>
          </DialogHeader>
          {selectedDay && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border p-2">
                  <p className="text-xs text-muted-foreground">Check-in</p>
                  <p className="font-medium">
                    {selectedDay.check_in_time
                      ? new Date(selectedDay.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-xs text-muted-foreground">Check-out</p>
                  <p className="font-medium">
                    {selectedDay.check_out_time
                      ? new Date(selectedDay.check_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border p-2">
                  <p className="text-xs text-muted-foreground">Total Hours</p>
                  <p className="font-medium">{formatHours(selectedDay.total_hours)}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-xs text-muted-foreground">Late</p>
                  <p className="font-medium">{selectedDay.is_late ? 'Yes' : 'No'}</p>
                </div>
              </div>
              {selectedDay.is_wfh && (
                <div className="rounded border border-blue-200 bg-blue-50 p-2 text-blue-700 text-xs">
                  Work from home
                </div>
              )}
              {selectedDay.is_manually_entered && (
                <div className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-700 text-xs">
                  Manually entered — {selectedDay.manual_entry_reason}
                </div>
              )}
              {selectedDay.is_geo_flagged && (
                <div className="rounded border border-red-200 bg-red-50 p-2 text-red-700 text-xs">
                  GPS anomaly flagged
                </div>
              )}
            </div>
          )}
          {onManualEntry && (
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  onManualEntry(selectedDay!.date)
                  setSelectedDay(null)
                }}
              >
                Manual Entry for this day
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
