import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useRole } from '@/hooks/useRole'
import { useAuthStore } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Users, Clock, Calendar, CheckCircle2, AlertTriangle, ArrowRight, Home } from 'lucide-react'
import { useCheckIn, useCheckOut, useLogWFH } from '@/features/attendance/mutations'
import { getCurrentPosition } from '@/features/attendance/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

async function fetchDashboardCounts() {
  const [empRes, leaveRes, regRes] = await Promise.all([
    supabase.from('employees').select('*', { head: true, count: 'exact' }).eq('is_active', true),
    supabase.from('leave_applications').select('*', { head: true, count: 'exact' }).eq('status', 'pending'),
    supabase.from('attendance_regularization_requests').select('*', { head: true, count: 'exact' }).eq('status', 'pending'),
  ])
  return {
    totalEmployees: empRes.count ?? 0,
    pendingLeaves: leaveRes.count ?? 0,
    pendingRegularizations: regRes.count ?? 0,
  }
}

async function fetchEmployeeDashboard() {
  const emp = useAuthStore.getState().employee
  if (!emp) return null

  const today = new Date().toISOString().split('T')[0]

  const [attendanceRes, leaveBalancesRes, pendingLeavesRes] = await Promise.all([
    supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', emp.id)
      .eq('date', today)
      .maybeSingle(),
    supabase
      .from('leave_balances')
      .select('*, leave_type:leave_types(name, code)')
      .eq('employee_id', emp.id),
    supabase
      .from('leave_applications')
      .select('*')
      .eq('employee_id', emp.id)
      .in('status', ['pending', 'approved'])
      .gte('from_date', today)
      .order('from_date')
      .limit(5),
  ])

  return {
    todayAttendance: attendanceRes.data,
    leaveBalances: leaveBalancesRes.data ?? [],
    upcomingLeaves: pendingLeavesRes.data ?? [],
  }
}

function OwnerDashboard() {
  const { data: counts, isLoading } = useQuery({
    queryKey: ['dashboard', 'counts'],
    queryFn: fetchDashboardCounts,
  })

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{counts?.totalEmployees ?? 0}</div>
          <p className="text-xs text-muted-foreground">Active employees</p>
          <Link to="/employees" className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Pending Leaves</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{counts?.pendingLeaves ?? 0}</div>
          <p className="text-xs text-muted-foreground">Awaiting approval</p>
          <Link to="/leave/team" className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1">
            Review leaves <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Regularizations</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{counts?.pendingRegularizations ?? 0}</div>
          <p className="text-xs text-muted-foreground">Pending requests</p>
          <Link to="/regularization" className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1">
            Review requests <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Reports</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Link to="/reports/attendance" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            View reports <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

function HRDashboard() {
  const emp = useAuthStore((s) => s.employee)
  const { data: counts } = useQuery({
    queryKey: ['dashboard', 'counts'],
    queryFn: fetchDashboardCounts,
  })
  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['dashboard', 'employee', emp?.id],
    queryFn: fetchEmployeeDashboard,
    enabled: !!emp,
  })

  const checkIn = useCheckIn()
  const checkOut = useCheckOut()
  const logWFH = useLogWFH()

  const [earlyCheckoutOpen, setEarlyCheckoutOpen] = useState(false)
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState('')

  const handleCheckIn = async () => {
    try {
      const coords = await getCurrentPosition()
      const result = await checkIn.mutateAsync(coords)
      toast.success(result.is_late ? 'Checked in — late' : 'Checked in successfully')
      refetch()
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Check-in failed')
    }
  }

  const handleCheckOutClick = () => {
    setEarlyCheckoutReason('')
    setEarlyCheckoutOpen(true)
  }

  const handleCheckOutConfirm = async () => {
    try {
      const coords = await getCurrentPosition()
      const body: Record<string, unknown> = {
        latitude: coords.latitude,
        longitude: coords.longitude,
      }
      if (earlyCheckoutReason.trim()) {
        body.early_checkout_reason = earlyCheckoutReason.trim()
      }
      const result = await checkOut.mutateAsync(body)
      setEarlyCheckoutOpen(false)
      toast.success(`Checked out. Total: ${result.total_hours}h`)
      refetch()
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Check-out failed')
    }
  }

  const handleLogWFH = async () => {
    try {
      await logWFH.mutateAsync()
      toast.success('WFH logged for today')
      refetch()
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed to log WFH')
    }
  }

  const checkedIn = !!dashboard?.todayAttendance?.check_in_time
  const checkedOut = !!dashboard?.todayAttendance?.check_out_time
  const isWFH = dashboard?.todayAttendance?.is_wfh ?? false

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {checkedIn
                ? `Checked in at ${new Date(dashboard!.todayAttendance!.check_in_time!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                : 'Not checked in today'}
            </span>
            {checkedIn && !checkedOut && (
              <span className="text-sm font-normal text-muted-foreground">In progress</span>
            )}
            {checkedOut && (
              <span className="text-sm font-normal text-muted-foreground">
                Checked out at {new Date(dashboard!.todayAttendance!.check_out_time!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row flex-wrap gap-3">
          <Button size="lg" disabled={checkedIn || checkIn.isPending || isWFH} onClick={handleCheckIn}>
            {checkIn.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
            Check In
          </Button>
          <Button size="lg" variant="outline" disabled={!checkedIn || checkedOut || checkOut.isPending} onClick={handleCheckOutClick}>
            {checkOut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Check Out
          </Button>
          <Button size="lg" variant="secondary" disabled={checkedIn || isWFH || logWFH.isPending} onClick={handleLogWFH}>
            {logWFH.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Home className="mr-2 h-4 w-4" />}
            {isWFH ? 'WFH Logged' : 'Log WFH'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Leaves</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{counts?.pendingLeaves ?? 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
            <Link to="/leave/team" className="text-xs text-primary hover:underline mt-2 inline-block">
              Review leave applications
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Regularizations</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{counts?.pendingRegularizations ?? 0}</div>
            <p className="text-xs text-muted-foreground">Pending requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Team</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts?.totalEmployees ?? 0}</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
            <Link to="/attendance/team" className="text-xs text-primary hover:underline mt-2 inline-block">
              View team attendance
            </Link>
          </CardContent>
        </Card>
      </div>

      <Dialog open={earlyCheckoutOpen} onOpenChange={setEarlyCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Early Checkout</DialogTitle>
            <DialogDescription>
              You are checking out before the shift ends. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for early checkout..."
            value={earlyCheckoutReason}
            onChange={(e) => setEarlyCheckoutReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEarlyCheckoutOpen(false)}>Cancel</Button>
            <Button onClick={handleCheckOutConfirm}>Confirm Checkout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmployeeDashboardView() {
  const emp = useAuthStore((s) => s.employee)
  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['dashboard', 'employee', emp?.id],
    queryFn: fetchEmployeeDashboard,
    enabled: !!emp,
  })

  const checkIn = useCheckIn()
  const checkOut = useCheckOut()
  const logWFH = useLogWFH()

  const [earlyCheckoutOpen, setEarlyCheckoutOpen] = useState(false)
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState('')

  const handleCheckIn = async () => {
    try {
      const coords = await getCurrentPosition()
      const result = await checkIn.mutateAsync(coords)
      toast.success(result.is_late ? 'Checked in — late' : 'Checked in successfully')
      refetch()
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Check-in failed')
    }
  }

  const handleCheckOutClick = () => {
    setEarlyCheckoutReason('')
    setEarlyCheckoutOpen(true)
  }

  const handleCheckOutConfirm = async () => {
    try {
      const coords = await getCurrentPosition()
      const body: Record<string, unknown> = {
        latitude: coords.latitude,
        longitude: coords.longitude,
      }
      if (earlyCheckoutReason.trim()) {
        body.early_checkout_reason = earlyCheckoutReason.trim()
      }
      const result = await checkOut.mutateAsync(body)
      setEarlyCheckoutOpen(false)
      toast.success(`Checked out. Total: ${result.total_hours}h`)
      refetch()
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Check-out failed')
    }
  }

  const handleLogWFH = async () => {
    try {
      await logWFH.mutateAsync()
      toast.success('WFH logged for today')
      refetch()
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed to log WFH')
    }
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  const checkedIn = !!dashboard?.todayAttendance?.check_in_time
  const checkedOut = !!dashboard?.todayAttendance?.check_out_time
  const isWFH = dashboard?.todayAttendance?.is_wfh ?? false

  return (
    <div className="space-y-6">
      {/* Check-in status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {checkedIn
                ? `Checked in at ${new Date(dashboard!.todayAttendance!.check_in_time!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                : 'Not checked in today'}
            </span>
            {checkedIn && !checkedOut && (
              <span className="text-sm font-normal text-muted-foreground">In progress</span>
            )}
            {checkedOut && (
              <span className="text-sm font-normal text-muted-foreground">
                Checked out at {new Date(dashboard!.todayAttendance!.check_out_time!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row flex-wrap gap-3">
          <Button
            size="lg"
            disabled={checkedIn || checkIn.isPending || isWFH}
            onClick={handleCheckIn}
          >
            {checkIn.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
            Check In
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={!checkedIn || checkedOut || checkOut.isPending}
            onClick={handleCheckOutClick}
          >
            {checkOut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Check Out
          </Button>
          <Button
            size="lg"
            variant="secondary"
            disabled={checkedIn || isWFH || logWFH.isPending}
            onClick={handleLogWFH}
          >
            {logWFH.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Home className="mr-2 h-4 w-4" />}
            {isWFH ? 'WFH Logged' : 'Log WFH'}
          </Button>
        </CardContent>
      </Card>

      {/* Leave Balances */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dashboard?.leaveBalances?.map((lb) => (
          <Card key={lb.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {lb.leave_type?.name ?? 'Leave'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(Number(lb.accrued) + Number(lb.opening_balance) + Number(lb.carry_forward_amount) - Number(lb.taken) - Number(lb.pending)).toFixed(1)}
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                <span>Used: {lb.taken}</span>
                <span>Pending: {lb.pending}</span>
              </div>
            </CardContent>
          </Card>
        ))}
        <Link to="/leave" className="flex items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 p-4 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
          Apply for leave <ArrowRight className="ml-1 h-3 w-3" />
        </Link>
      </div>

      {/* Upcoming Leaves */}
      {dashboard?.upcomingLeaves && dashboard.upcomingLeaves.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Upcoming Leaves</span>
              <Link to="/leave" className="text-xs font-normal text-primary hover:underline inline-flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.upcomingLeaves.map((leave) => (
              <div key={leave.id} className="flex items-center justify-between text-sm">
                <span>
                  {leave.from_date} — {leave.to_date}
                </span>
                <Badge variant={leave.status === 'approved' ? 'secondary' : 'default'}>
                  {leave.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Early checkout dialog */}
      <Dialog open={earlyCheckoutOpen} onOpenChange={setEarlyCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Early Checkout</DialogTitle>
            <DialogDescription>
              You are checking out before the shift ends. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for early checkout..."
            value={earlyCheckoutReason}
            onChange={(e) => setEarlyCheckoutReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEarlyCheckoutOpen(false)}>Cancel</Button>
            <Button onClick={handleCheckOutConfirm}>Confirm Checkout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function DashboardPage() {
  const { isOwner, isHR, isEmployee, isSystemAdmin } = useRole()

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-semibold">Dashboard</h1>

      {isOwner && <OwnerDashboard />}
      {isHR && <HRDashboard />}
      {isEmployee && <EmployeeDashboardView />}
      {isSystemAdmin && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">All systems operational.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/settings/ip-whitelist" className="block text-sm text-primary hover:underline">
                IP Whitelist
              </Link>
              <Link to="/settings/geofence" className="block text-sm text-primary hover:underline">
                Geofence Configuration
              </Link>
              <Link to="/employees" className="block text-sm text-primary hover:underline">
                Employee Directory
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
