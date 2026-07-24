import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchDailyAttendance, type DailyAttendanceRow } from '@/features/reports/api'
import { formatHours } from '@/features/attendance/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, ChevronLeft, ChevronRight, Download, User } from 'lucide-react'

const STATUS_STYLES: Record<string, string> = {
  present: 'text-green-700 bg-green-50 border-green-200',
  absent: 'text-red-700 bg-red-50 border-red-200',
  work_from_home: 'text-blue-700 bg-blue-50 border-blue-200',
  on_leave: 'text-purple-700 bg-purple-50 border-purple-200',
  half_day: 'text-orange-700 bg-orange-50 border-orange-200',
  late: 'text-green-700 bg-green-50 border-green-200',
  holiday: 'text-gray-500 bg-gray-100 border-gray-200',
  weekly_off: 'text-gray-400 bg-gray-50 border-gray-200',
}

const STATUS_CLASS: Record<string, string> = {
  present: 'text-green-600 bg-green-50',
  absent: 'text-red-600 bg-red-50',
  work_from_home: 'text-blue-600 bg-blue-50',
  on_leave: 'text-purple-600 bg-purple-50',
  half_day: 'text-orange-600 bg-orange-50',
  late: 'text-green-600 bg-green-50',
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
  const headers = ['Team Member', 'Code', 'Department', 'Check In', 'Check Out', 'Late', 'WFH', 'Hours']
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

function getStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function MobileCard({ r }: { r: DailyAttendanceRow }) {
  const isOff = r.status === 'absent' || r.status === 'holiday' || r.status === 'weekly_off'

  return (
    <Card className={isOff ? 'opacity-70' : ''}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="truncate">
              <p className="text-sm font-medium truncate">{r.employeeName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{r.employeeCode} · {r.departmentName ?? '—'}</p>
            </div>
          </div>
          {isOff ? (
            <Badge variant="outline" className={`shrink-0 text-[10px] ${STATUS_STYLES[r.status] ?? ''}`}>
              {getStatusLabel(r.status)}
            </Badge>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              {r.isWfh && <Badge variant="outline" className="text-[10px] text-blue-700 bg-blue-50 border-blue-200">WFH</Badge>}
              {r.isLate && <Badge variant="outline" className="text-[10px] text-green-700 bg-green-50 border-green-200">Late</Badge>}
            </div>
          )}
        </div>
        {!isOff && (
          <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t">
            <div>
              <p className="text-muted-foreground">Check In</p>
              <p className="font-mono font-medium">{formatTime(r.checkIn)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Check Out</p>
              <p className="font-mono font-medium">{formatTime(r.checkOut)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Hours</p>
              <p className="font-mono font-medium">{formatHours(r.totalHours)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold">Daily Attendance</h1>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs sm:text-sm font-medium min-w-0 px-1 text-center leading-tight">
            {formatDate(date)}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => exportCSV(rows ?? [], dateStr)} disabled={!rows}>
            <Download className="mr-1 h-3.5 w-3.5" />CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !rows || rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No active team members found.</CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="space-y-2 sm:hidden">
            {rows.map((r) => (
              <MobileCard key={r.employeeId} r={r} />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px]">Team Member</TableHead>
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
                          <TableCell className="font-medium whitespace-nowrap">
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
                                {getStatusLabel(r.status)}
                              </span>
                            ) : (
<span className={r.isLate ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
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
          </div>
        </>
      )}
    </div>
  )
}
