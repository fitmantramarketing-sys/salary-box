import { useState } from 'react'
import { useRegularizationLog, useDepartments } from '@/features/reports/hooks'
import { downloadCSV } from '@/features/reports/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Loader2, Download } from 'lucide-react'

const REG_STATUS_STYLES: Record<string, string> = {
  approved: 'text-green-700 bg-green-50',
  rejected: 'text-red-700 bg-red-50',
  pending: 'text-yellow-700 bg-yellow-50',
}

export default function ReportsRegularizationPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [departmentId, setDepartmentId] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')

  const { data: departments } = useDepartments()
  const { data: report, isLoading } = useRegularizationLog(
    dateFrom || undefined,
    dateTo || undefined,
    departmentId !== 'all' ? departmentId : undefined,
    status !== 'all' ? status : undefined
  )

  function exportCSV() {
    if (!report) return
    const headers = ['Team Member', 'Code', 'Date', 'Requested Status', 'Reason', 'Status', 'Reviewer', 'Comment', 'Submitted']
    const rows = report.map((r) => [
      r.employeeName, r.employeeCode, r.date, r.requestedStatus,
      r.reason, r.status, r.reviewerName ?? '—', r.reviewerComment ?? '—', r.createdAt,
    ])
    downloadCSV(headers, rows, 'regularization-log.csv')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Regularization Log</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 h-8 text-sm" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 h-8 text-sm" />
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments?.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!report}>
            <Download className="mr-2 h-4 w-4" />CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !report || report.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No regularization requests found.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">Team Member</TableHead>
                    <TableHead className="sticky left-[160px] bg-background z-10">Code</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Requested Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="sticky left-0 bg-background font-medium whitespace-nowrap">{r.employeeName}</TableCell>
                      <TableCell className="sticky left-[160px] bg-background font-mono text-xs">{r.employeeCode}</TableCell>
                      <TableCell className="font-mono text-xs">{r.date}</TableCell>
                      <TableCell className="capitalize">{r.requestedStatus.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={r.reason}>{r.reason}</TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${REG_STATUS_STYLES[r.status] ?? ''}`}>
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell>{r.reviewerName ?? '—'}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={r.reviewerComment ?? ''}>{r.reviewerComment ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
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
