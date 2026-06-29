import { useState } from 'react'
import { useAuthStore } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import { useAttendanceReport, useSelfAttendance, useAbsenteeismData, useDepartments } from '@/features/reports/hooks'
import { downloadCSV } from '@/features/reports/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react'

const STATUS_CLASS: Record<string, string> = {
  present: 'text-green-600 bg-green-50',
  absent: 'text-red-600 bg-red-50',
  work_from_home: 'text-blue-600 bg-blue-50',
  on_leave: 'text-purple-600 bg-purple-50',
  half_day: 'text-orange-600 bg-orange-50',
  holiday: 'text-gray-500 bg-gray-100',
  weekly_off: 'text-gray-400 bg-gray-50',
  incomplete: 'text-yellow-600 bg-yellow-50',
}

export default function ReportsAttendancePage() {
  const { isEmployee } = useRole()
  const employeeId = useAuthStore((s) => s.employee?.id)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [departmentId, setDepartmentId] = useState<string>('all')

  const [tab, setTab] = useState<'report' | 'absenteeism'>('report')

  const { data: departments } = useDepartments()
  const { data: report, isLoading } = useAttendanceReport(
    year, month,
    departmentId && departmentId !== 'all' ? departmentId : undefined
  )
  const { data: absenteeismData, isLoading: absLoading } = useAbsenteeismData(
    year, month,
    departmentId && departmentId !== 'all' ? departmentId : undefined
  )
  const { data: selfReport, isLoading: selfLoading } = useSelfAttendance(employeeId ?? '', year, month)

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' })

  function exportCSV() {
    if (!report) return
    const headers = ['Employee', 'Code', 'Department', 'Present', 'WFH', 'Absent', 'On Leave', 'Half Day', 'Late Marks']
    const rows = report.map((r) => [
      r.employeeName, r.employeeCode, r.departmentName ?? '',
      String(r.presentDays), String(r.wfhDays), String(r.absentDays),
      String(r.onLeaveDays), String(r.halfDayDays), String(r.lateMarks),
    ])
    downloadCSV(headers, rows, `attendance-report-${monthName}-${year}.csv`)
  }

  function exportAbsenteeismCSV() {
    if (!absenteeismData) return
    const headers = ['Employee', 'Code', 'Department', 'Absent Days', 'Total Work Days', 'Absence Rate (%)']
    const rows = absenteeismData.map((r) => [
      r.employeeName, r.employeeCode, r.departmentName ?? '',
      String(r.absentDays), String(r.totalWorkDays), String(r.absenceRate),
    ])
    downloadCSV(headers, rows, `absenteeism-${monthName}-${year}.csv`)
  }

  function exportSelfCSV() {
    if (!selfReport) return
    const headers = ['Date', 'Day', 'Status', 'Check In', 'Check Out', 'Hours', 'Late', 'WFH']
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const rows = selfReport.map((r) => [
      r.date, days[r.dayOfWeek], r.status,
      r.checkIn ?? '—', r.checkOut ?? '—',
      r.totalHours?.toFixed(2) ?? '—',
      r.isLate ? 'Yes' : 'No', r.isWfh ? 'Yes' : 'No',
    ])
    downloadCSV(headers, rows, `my-attendance-${monthName}-${year}.csv`)
  }

  if (isEmployee) {
    const present = selfReport?.filter((r) => r.status === 'present').length ?? 0
    const wfh = selfReport?.filter((r) => r.status === 'work_from_home' || r.isWfh).length ?? 0
    const absent = selfReport?.filter((r) => r.status === 'absent').length ?? 0
    const onLeave = selfReport?.filter((r) => r.status === 'on_leave').length ?? 0
    const late = selfReport?.filter((r) => r.isLate).length ?? 0

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">My Attendance</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium min-w-[140px] text-center">{monthName} {year}</span>
            <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={exportSelfCSV} disabled={!selfReport}>
              <Download className="mr-2 h-4 w-4" />CSV
            </Button>
          </div>
        </div>

        {selfLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !selfReport ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No data available.</CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Present', count: present, cls: 'text-green-700 bg-green-50' },
                { label: 'WFH', count: wfh, cls: 'text-blue-700 bg-blue-50' },
                { label: 'Absent', count: absent, cls: 'text-red-700 bg-red-50' },
                { label: 'On Leave', count: onLeave, cls: 'text-purple-700 bg-purple-50' },
                { label: 'Late', count: late, cls: 'text-yellow-700 bg-yellow-50' },
              ].map((item) => (
                <div key={item.label} className={`rounded-lg border p-3 text-center ${item.cls}`}>
                  <p className="text-xl font-bold">{item.count}</p>
                  <p className="text-xs">{item.label}</p>
                </div>
              ))}
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Late</TableHead>
                        <TableHead>WFH</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selfReport.map((r) => (
                        <TableRow key={r.date}>
                          <TableCell className="font-mono text-xs">{r.date}</TableCell>
                          <TableCell>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][r.dayOfWeek]}</TableCell>
                          <TableCell>
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[r.status] ?? 'text-gray-500'}`}>
                              {r.status.replace(/_/g, ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                          <TableCell>{r.totalHours?.toFixed(1) ?? '—'}</TableCell>
                          <TableCell>{r.isLate ? 'Yes' : 'No'}</TableCell>
                          <TableCell>{r.isWfh ? 'Yes' : 'No'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b">
        <button
          onClick={() => setTab('report')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'report'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Attendance Report
        </button>
        <button
          onClick={() => setTab('absenteeism')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'absenteeism'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Absenteeism
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">
          {tab === 'report' ? 'Attendance Report' : 'Absenteeism'}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments?.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium min-w-[140px] text-center">{monthName} {year}</span>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          {tab === 'report' ? (
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!report}>
              <Download className="mr-2 h-4 w-4" />CSV
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={exportAbsenteeismCSV} disabled={!absenteeismData}>
              <Download className="mr-2 h-4 w-4" />CSV
            </Button>
          )}
        </div>
      </div>

      {tab === 'report' ? (
        isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !report || report.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No attendance data for this period.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">Employee</TableHead>
                      <TableHead className="sticky left-[180px] bg-background z-10">Code</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center text-green-700">Present</TableHead>
                      <TableHead className="text-center text-blue-700">WFH</TableHead>
                      <TableHead className="text-center text-red-700">Absent</TableHead>
                      <TableHead className="text-center text-purple-700">On Leave</TableHead>
                      <TableHead className="text-center text-orange-700">Half Day</TableHead>
                      <TableHead className="text-center text-yellow-700">Late</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.map((r) => (
                      <TableRow key={r.employeeId}>
                        <TableCell className="sticky left-0 bg-background font-medium whitespace-nowrap">{r.employeeName}</TableCell>
                        <TableCell className="sticky left-[180px] bg-background font-mono text-xs">{r.employeeCode}</TableCell>
                        <TableCell className="text-sm">{r.departmentName ?? '—'}</TableCell>
                        <TableCell className="text-center font-medium text-green-700">{r.presentDays}</TableCell>
                        <TableCell className="text-center font-medium text-blue-700">{r.wfhDays}</TableCell>
                        <TableCell className="text-center font-medium text-red-700">{r.absentDays}</TableCell>
                        <TableCell className="text-center font-medium text-purple-700">{r.onLeaveDays}</TableCell>
                        <TableCell className="text-center font-medium text-orange-700">{r.halfDayDays}</TableCell>
                        <TableCell className="text-center font-medium text-yellow-700">{r.lateMarks}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell className="sticky left-0 bg-muted/50" colSpan={3}>Total</TableCell>
                      <TableCell className="text-center">{report.reduce((s, r) => s + r.presentDays, 0)}</TableCell>
                      <TableCell className="text-center">{report.reduce((s, r) => s + r.wfhDays, 0)}</TableCell>
                      <TableCell className="text-center">{report.reduce((s, r) => s + r.absentDays, 0)}</TableCell>
                      <TableCell className="text-center">{report.reduce((s, r) => s + r.onLeaveDays, 0)}</TableCell>
                      <TableCell className="text-center">{report.reduce((s, r) => s + r.halfDayDays, 0)}</TableCell>
                      <TableCell className="text-center">{report.reduce((s, r) => s + r.lateMarks, 0)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        absLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !absenteeismData || absenteeismData.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No absenteeism data for this period.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">Employee</TableHead>
                      <TableHead className="sticky left-[180px] bg-background z-10">Code</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center">Absent Days</TableHead>
                      <TableHead className="text-center">Total Work Days</TableHead>
                      <TableHead className="text-center">Absence Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {absenteeismData.map((r) => {
                      const rateColor =
                        r.absenceRate < 10 ? 'text-green-600' :
                        r.absenceRate <= 25 ? 'text-yellow-600' :
                        'text-red-600'
                      return (
                        <TableRow key={r.employeeId}>
                          <TableCell className="sticky left-0 bg-background font-medium whitespace-nowrap">{r.employeeName}</TableCell>
                          <TableCell className="sticky left-[180px] bg-background font-mono text-xs">{r.employeeCode}</TableCell>
                          <TableCell className="text-sm">{r.departmentName ?? '—'}</TableCell>
                          <TableCell className="text-center">{r.absentDays}</TableCell>
                          <TableCell className="text-center">{r.totalWorkDays}</TableCell>
                          <TableCell className={`text-center font-semibold ${rateColor}`}>
                            {r.absenceRate}%
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  )
}
