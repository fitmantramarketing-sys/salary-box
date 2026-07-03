import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchDailyAttendance, type DailyAttendanceRow } from '@/features/reports/api'
import { formatHours } from '@/features/attendance/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react'

const STATUS_CLASS: Record<string, string> = {
  present: 'text-green-600 bg-green-50',
  absent: 'text-red-600 bg-red-50',
  work_from_home: 'text-blue-600 bg-blue-50',
  on_leave: 'text-purple-600 bg-purple-50',
  half_day: 'text-orange-600 bg-orange-50',
  holiday: 'text-gray-500 bg-gray-100',
  weekly_off: 'text-gray-400 bg-gray-50',
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })
}

function dateToStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function exportCSV(rows: DailyAttendanceRow[], dateStr: string) {
  const headers = ['Employee', 'Code', 'Department', 'Check In', 'Check Out', 'Late', 'WFH', 'Hours']
  const data = rows.map((r) => [
    r.employeeName,
    r.employeeCode,
    r.departmentName ?? '',
    formatTime(r.checkIn),
    formatTime(r.checkOut),
    r.status === 'absent' || r.status === 'holiday' || r.status === 'weekly_off'
      ? r.status.replace(/_/g, ' ')
      : r.isLate ? 'Yes' : 'No',
    r.isWfh ? 'Yes' : 'No',
    r.totalHours != null ? r.totalHours.toFixed(2) : '—',
  ])
  const csv = [headers, ...data].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `daily-attendance-${dateStr}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function DailyAttendanceReportPage() {
  const [date, setDate] = useState(new Date())

  const dateStr = dateToStr(date)

  const { data: rows, isLoading } = useQuery({
    queryKey: ['daily-attendance', dateStr],
    queryFn: () => fetchDailyAttendance(dateStr),
  })

  const prevDay = () => setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))
  const nextDay = () => setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Daily Attendance</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[200px] text-center">{formatDate(date)}</span>
          <Button variant="outline" size="icon" onClick={nextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCSV(rows ?? [], dateStr)} disabled={!rows} className="ml-2">
            <Download className="mr-2 h-4 w-4" />CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !rows || rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No active employees found.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]">Employee</TableHead>
                    <TableHead className="min-w-[80px]">Check In</TableHead>
                    <TableHead className="min-w-[80px]">Check Out</TableHead>
                    <TableHead className="min-w-[60px]">Late</TableHead>
                    <TableHead className="min-w-[60px]">WFH</TableHead>
                    <TableHead className="min-w-[60px]">Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.employeeId}>
                      <TableCell className="sticky left-0 bg-background font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{r.employeeName}</span>
                          <span className="text-xs text-muted-foreground">({r.employeeCode})</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{r.departmentName ?? '—'}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{formatTime(r.checkIn)}</TableCell>
                      <TableCell className="font-mono text-xs">{formatTime(r.checkOut)}</TableCell>
                      <TableCell>
                        {r.status === 'absent' || r.status === 'holiday' || r.status === 'weekly_off' ? (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[r.status] ?? ''}`}>
                            {r.status.replace(/_/g, ' ')}
                          </span>
                        ) : (
                          <span className={r.isLate ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                            {r.isLate ? 'Yes' : 'No'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={r.isWfh ? 'text-blue-600 font-medium' : 'text-muted-foreground'}>
                          {r.isWfh ? 'Yes' : 'No'}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{formatHours(r.totalHours)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
