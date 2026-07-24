import { useRole } from '@/hooks/useRole'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { BarChart3, Grid3x3, Users, ClipboardList, Calendar } from 'lucide-react'

type ReportLink = {
  label: string
  href: string
  description: string
  icon: React.ElementType
  roles: string[]
}

const REPORTS: ReportLink[] = [
  { label: 'Attendance Report', href: '/reports/attendance', description: 'Monthly attendance summary with CSV export', icon: BarChart3, roles: ['owner', 'hr', 'employee'] },
  { label: 'Leave Report', href: '/reports/leave', description: 'Leave balance report by employee and type', icon: Calendar, roles: ['owner', 'hr'] },
  { label: 'Headcount', href: '/reports/headcount', description: 'Team member headcount by status, type, and department', icon: Users, roles: ['owner', 'system_admin'] },
  { label: 'Regularization Log', href: '/reports/regularization', description: 'Audit trail of all regularization requests', icon: ClipboardList, roles: ['owner'] },
  { label: 'Attendance Heatmap', href: '/reports/heatmap', description: 'Department attendance percentage heatmap', icon: Grid3x3, roles: ['owner'] },
  { label: 'Daily Attendance', href: '/reports/daily', description: 'Day-by-day check-in, check-out, late, WFH, hours', icon: BarChart3, roles: ['owner'] },
]

export default function ReportsHomePage() {
  const { role } = useRole()

  const visible = REPORTS.filter((r) => role && r.roles.includes(role))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((report) => (
          <Link key={report.href} to={report.href}>
            <Card className="h-full transition-colors hover:bg-accent/50 cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <div className="rounded-md bg-primary/10 p-2">
                  <report.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">{report.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{report.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
