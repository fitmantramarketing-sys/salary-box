import type { AttendanceRecord } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = { records: AttendanceRecord[] | undefined }

export function AttendanceSummaryCards({ records }: Props) {
  if (!records) return null

  const present = records.filter((r) => r.status === 'present').length
  const absent = records.filter((r) => r.status === 'absent').length
  const incomplete = records.filter((r) => r.status === 'incomplete').length
  const wfh = records.filter((r) => r.status === 'work_from_home' || r.is_wfh).length
  const late = records.filter((r) => r.is_late).length
  const onLeave = records.filter((r) => r.status === 'on_leave').length
  const halfDay = records.filter((r) => r.status === 'half_day').length

  const items = [
    { label: 'Present', count: present, className: 'bg-green-50 text-green-700' },
    { label: 'Absent', count: absent, className: 'bg-red-50 text-red-700' },
    { label: 'Incomplete', count: incomplete, className: 'bg-yellow-50 text-yellow-700' },
    { label: 'WFH', count: wfh, className: 'bg-blue-50 text-blue-700' },
    { label: 'Late', count: late, className: 'bg-yellow-50 text-yellow-700' },
    { label: 'On Leave', count: onLeave, className: 'bg-purple-50 text-purple-700' },
    { label: 'Half Day', count: halfDay, className: 'bg-orange-50 text-orange-700' },
  ]

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">This Month</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {items.map(({ label, count, className }) => (
            <div key={label} className={`rounded-lg border p-3 text-center ${className}`}>
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs">{label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
