import { useState, useMemo } from 'react'
import { useHeadcountReport, useDepartments } from '@/features/reports/hooks'
import { downloadCSV } from '@/features/reports/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Download } from 'lucide-react'

const STATUS_STYLES: Record<string, string> = {
  active: 'text-green-700 bg-green-50',
  on_probation: 'text-yellow-700 bg-yellow-50',
  resigned: 'text-orange-700 bg-orange-50',
  terminated: 'text-red-700 bg-red-50',
  on_leave: 'text-purple-700 bg-purple-50',
}

export default function ReportsHeadcountPage() {
  const [departmentId, setDepartmentId] = useState<string>('all')
  const [employmentStatus, setEmploymentStatus] = useState<string>('all')
  const [employmentType, setEmploymentType] = useState<string>('all')

  const { data: departments } = useDepartments()
  const { data: report, isLoading } = useHeadcountReport(
    departmentId !== 'all' ? departmentId : undefined,
    employmentStatus !== 'all' ? employmentStatus : undefined,
    employmentType !== 'all' ? employmentType : undefined
  )

  const summary = useMemo(() => {
    if (!report) return null
    const counts: Record<string, number> = {}
    for (const r of report) {
      counts[r.employmentStatus] = (counts[r.employmentStatus] ?? 0) + 1
    }
    return counts
  }, [report])

  function exportCSV() {
    if (!report) return
    const headers = ['Team Member', 'Code', 'Department', 'Designation', 'Type', 'Status', 'Join Date', 'Exit Date']
    const rows = report.map((r) => [
      r.name, r.employeeCode, r.departmentName ?? '',
      r.designationName ?? '', r.employmentType, r.employmentStatus,
      r.joinDate, r.exitDate ?? '',
    ])
    downloadCSV(headers, rows, 'headcount-report.csv')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Headcount Report</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments?.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={employmentStatus} onValueChange={setEmploymentStatus}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_probation">On Probation</SelectItem>
              <SelectItem value="resigned">Resigned</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
          <Select value={employmentType} onValueChange={setEmploymentType}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="full_time">Full Time</SelectItem>
              <SelectItem value="part_time">Part Time</SelectItem>
              <SelectItem value="contractor">Contractor</SelectItem>
              <SelectItem value="intern">Intern</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!report}>
            <Download className="mr-2 h-4 w-4" />CSV
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(summary).map(([status, count]) => (
            <div key={status} className={`rounded-lg border p-3 text-center ${STATUS_STYLES[status] ?? ''}`}>
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs capitalize">{status.replace(/_/g, ' ')}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !report || report.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No employees found for the selected filters.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">Team Member</TableHead>
                    <TableHead className="sticky left-[180px] bg-background z-10">Code</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Join Date</TableHead>
                    <TableHead>Exit Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="sticky left-0 bg-background font-medium whitespace-nowrap">{r.name}</TableCell>
                      <TableCell className="sticky left-[180px] bg-background font-mono text-xs">{r.employeeCode}</TableCell>
                      <TableCell>{r.departmentName ?? '—'}</TableCell>
                      <TableCell>{r.designationName ?? '—'}</TableCell>
                      <TableCell className="capitalize">{r.employmentType.replace(/_/g, ' ')}</TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[r.employmentStatus] ?? ''}`}>
                          {r.employmentStatus.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.joinDate}</TableCell>
                      <TableCell className="font-mono text-xs">{r.exitDate ?? '—'}</TableCell>
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
