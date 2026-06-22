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
}

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-500 hover:bg-green-600',
  absent: 'bg-red-500 hover:bg-red-600',
  half_day: 'bg-orange-400 hover:bg-orange-500',
  work_from_home: 'bg-blue-500 hover:bg-blue-600',
  on_leave: 'bg-purple-500 hover:bg-purple-600',
  holiday: 'bg-gray-300 hover:bg-gray-400',
  weekly_off: 'bg-gray-200 hover:bg-gray-300',
  incomplete: 'bg-yellow-400 hover:bg-yellow-500',
}

export function AttendanceCalendar({ records, year, month, onPrevMonth, onNextMonth }: Props) {
  const [selectedDay, setSelectedDay] = useState<AttendanceRecord | null>(null)
  const [showAll, setShowAll] = useState(false)

  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set())

  useEffect(() => {
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    supabase.from('holidays').select('date').gte('date', from).lte('date', to).then(({ data }) => {
      setHolidayDates(new Set((data ?? []).map((h) => h.date)))
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
              {!showAll && <Button variant="ghost" size="icon" onClick={() => setShowAll(true)}>All</Button>}
              <Button variant="ghost" size="icon" onClick={onNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map((day) => {
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const record = recordMap.get(dateStr)
              const rawStatus = record?.status as string | undefined
              const isHoliday = !rawStatus && holidayDates.has(dateStr)
              const status = isHoliday ? 'holiday' : (rawStatus ?? (showAll ? 'absent' : null))

              if (!status) return <div key={day} className="aspect-square" />

              return isHoliday ? (
                <div
                  key={day}
                  className={cn(
                    'aspect-square rounded-md text-xs flex items-center justify-center text-white font-medium',
                    STATUS_COLORS['holiday']
                  )}
                  title="Holiday"
                >
                  {day}
                </div>
              ) : (
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
                    'aspect-square rounded-md text-xs flex items-center justify-center text-white font-medium transition-colors',
                    STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-400'
                  )}
                  title={status}
                >
                  {day}
                </button>
              )
            })}
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
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded border p-2">
                  <p className="text-xs text-muted-foreground">Total Hours</p>
                  <p className="font-medium">{formatHours(selectedDay.total_hours)}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-xs text-muted-foreground">Overtime</p>
                  <p className="font-medium">{formatHours(selectedDay.overtime_hours)}</p>
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
        </DialogContent>
      </Dialog>
    </>
  )
}
