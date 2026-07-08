import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRole } from '@/hooks/useRole'
import { supabase } from '@/lib/supabase'
import { callEdgeFunction } from '@/lib/edge'
import { fetchAttendanceRecordByDate } from '@/features/attendance/api'
import { useRegularizationHistory, useAppConfig } from '@/features/attendance/hooks'
import { useSubmitRegularization } from '@/features/attendance/mutations'
import { submitRegularizationSchema, type SubmitRegularizationForm } from '@/features/attendance/schemas'
import { getAttendanceStatusLabel, formatHours } from '@/features/attendance/utils'
import type { AttendanceStatus } from '@/features/attendance/types'
import { useAuthStore } from '@/hooks/useAuth'
import type { AttendanceRecord } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Loader2, Plus, CheckCircle2, XCircle } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'work_from_home', label: 'Work From Home' },
] as const

async function fetchEarlyCheckouts() {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('id, employee_id, date, check_in_time, check_out_time, total_hours, is_late, early_checkout_reason, early_checkout_status, employee:employees!employee_id(id, first_name, last_name, employee_code)')
    .eq('early_checkout_status', 'pending')
    .not('early_checkout_reason', 'is', null)
    .order('date', { ascending: false })
  if (error) throw error
  return data as Array<{
    id: string
    employee_id: string
    date: string
    check_in_time: string | null
    check_out_time: string | null
    total_hours: number | null
    is_late: boolean
    early_checkout_reason: string | null
    early_checkout_status: string | null
    employee: { id: string; first_name: string; last_name: string; employee_code: string } | null
  }>
}

async function fetchPendingReviews() {
  const { data, error } = await supabase
    .from('attendance_regularization_requests')
    .select('*, employee:employees!employee_id(id, first_name, last_name, employee_code), attendance_record:attendance_record_id(id, date, check_in_time, check_out_time, status, is_wfh, total_hours)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Array<{
    id: string
    employee_id: string
    attendance_record_id: string
    requested_status: string
    requested_check_in: string | null
    requested_check_out: string | null
    reason: string
    created_at: string
    employee: { id: string; first_name: string; last_name: string; employee_code: string } | null
    attendance_record: { id: string; date: string; check_in_time: string | null; check_out_time: string | null; status: string; is_wfh: boolean; total_hours: number | null } | null
  }>
}

function NewRequestDialog() {
  const { data: windowDaysStr } = useAppConfig('regularization_window_days')
  const windowDays = parseInt(windowDaysStr ?? '7', 10)
  const submitReg = useSubmitRegularization()
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [recordId, setRecordId] = useState<string | null>(null)
  const [recordDetails, setRecordDetails] = useState<AttendanceRecord | null>(null)
  const [resolving, setResolving] = useState(false)

  const today = new Date()
  const minDate = new Date(today)
  minDate.setDate(minDate.getDate() - windowDays + 1)

  const form = useForm<SubmitRegularizationForm>({
    resolver: zodResolver(submitRegularizationSchema),
    defaultValues: { attendance_record_id: '', requested_status: 'present', reason: '' },
  })

  async function handleDateChange(date: string) {
    setSelectedDate(date)
    if (!date) { setRecordId(null); setRecordDetails(null); return }

    setResolving(true)
    setRecordId(null)
    setRecordDetails(null)
    form.setValue('attendance_record_id', '')

    try {
      const emp = useAuthStore.getState().employee
      if (!emp) return
      const record = await fetchAttendanceRecordByDate(emp.id, date)
      if (record) {
        setRecordId(record.id)
        setRecordDetails(record)
        form.setValue('attendance_record_id', record.id, { shouldValidate: true })
      } else {
        toast.error('No attendance record found for this date')
      }
    } catch {
      toast.error('Failed to look up attendance record')
    } finally {
      setResolving(false)
    }
  }

  const onSubmit = async (values: SubmitRegularizationForm) => {
    try {
      // Convert datetime-local values (local time, no timezone) to UTC ISO strings
      // so timestamptz columns store the correct absolute time
      const payload = {
        ...values,
        requested_check_in: values.requested_check_in
          ? new Date(values.requested_check_in).toISOString()
          : undefined,
        requested_check_out: values.requested_check_out
          ? new Date(values.requested_check_out).toISOString()
          : undefined,
      }
      await submitReg.mutateAsync(payload)
      toast.success('Regularization request submitted')
      form.reset()
      setSelectedDate('')
      setRecordId(null)
      setRecordDetails(null)
      setOpen(false)
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed to submit request')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />New Request</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Regularization Request</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              min={minDate.toISOString().split('T')[0]}
              max={today.toISOString().split('T')[0]}
              required
            />
            <p className="text-xs text-muted-foreground">
              Select a date within the last {windowDays} days
            </p>
          </div>

          {resolving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Looking up record...
            </div>
          )}

          {recordDetails && !resolving && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Current status:</span> {getAttendanceStatusLabel(recordDetails.status)}</p>
              {recordDetails.check_in_time && (
                <p><span className="text-muted-foreground">Check-in:</span> {new Date(recordDetails.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
              )}
              {recordDetails.check_out_time && (
                <p><span className="text-muted-foreground">Check-out:</span> {new Date(recordDetails.check_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
              )}
              {recordDetails.is_wfh && <p><span className="text-muted-foreground">WFH:</span> Yes</p>}
              {recordDetails.total_hours != null && (
                <p><span className="text-muted-foreground">Total hours:</span> {formatHours(recordDetails.total_hours)}</p>
              )}
            </div>
          )}

          <input type="hidden" {...form.register('attendance_record_id')} />
          {form.formState.errors.attendance_record_id && (
            <p className="text-xs text-red-500">{form.formState.errors.attendance_record_id.message}</p>
          )}

          <div className="space-y-2">
            <Label>Requested Status</Label>
            <Select
              value={form.watch('requested_status')}
              onValueChange={(v) => form.setValue('requested_status', v as SubmitRegularizationForm['requested_status'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Requested Check-in (optional)</Label>
            <Input type="datetime-local" {...form.register('requested_check_in')} />
            {form.formState.errors.requested_check_in && (
              <p className="text-xs text-red-500">{form.formState.errors.requested_check_in.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Requested Check-out (optional)</Label>
            <Input type="datetime-local" {...form.register('requested_check_out')} />
            {form.formState.errors.requested_check_out && (
              <p className="text-xs text-red-500">{form.formState.errors.requested_check_out.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea {...form.register('reason')} placeholder="Why are you requesting this change?" />
            {form.formState.errors.reason && (
              <p className="text-xs text-red-500">{form.formState.errors.reason.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={submitReg.isPending || !recordId}>
            {submitReg.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit Request
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MyRequestsTab() {
  const { data: requests, isLoading } = useRegularizationHistory()

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return variants[status] ?? 'bg-gray-100 text-gray-800'
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Request History</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !requests || requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No regularization requests yet.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">{req.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    Requested: {req.requested_status}
                    {req.requested_check_in && ` · Check-in: ${new Date(req.requested_check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                    {req.requested_check_out && ` · Check-out: ${new Date(req.requested_check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleDateString('en-IN')}
                    {req.reviewer_comment && ` · Review: ${req.reviewer_comment}`}
                  </p>
                </div>
                <Badge className={statusBadge(req.status)}>{req.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EarlyCheckoutsTab() {
  const qc = useQueryClient()
  const [confirmDialog, setConfirmDialog] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null)

  const { data: earlyCheckouts, isLoading } = useQuery({
    queryKey: ['attendance', 'early-checkouts', 'pending'],
    queryFn: fetchEarlyCheckouts,
  })

  const resolveMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const supabase = await import('@/lib/supabase').then((m) => m.supabase)
      const { error } = await supabase
        .from('attendance_records')
        .update({
          early_checkout_status: action === 'approve' ? 'approved' : 'rejected',
          ...(action === 'reject' ? { status: 'absent' } : {}),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] })
      toast.success('Early checkout reviewed')
      setConfirmDialog(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Pending Early Checkouts ({earlyCheckouts?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!earlyCheckouts || earlyCheckouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending early checkouts.</p>
          ) : (
            <div className="space-y-3">
              {earlyCheckouts.map((rec) => (
                <div key={rec.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {rec.employee?.first_name} {rec.employee?.last_name}
                        <span className="text-muted-foreground font-normal"> ({rec.employee?.employee_code})</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Date: {rec.date}</p>
                      {rec.check_in_time && (
                        <p className="text-xs text-muted-foreground">
                          Check-in: {new Date(rec.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          {rec.check_out_time && ` → Check-out: ${new Date(rec.check_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      )}
                      <p className="text-xs italic">Reason: {rec.early_checkout_reason}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        disabled={resolveMutation.isPending}
                        onClick={() => resolveMutation.mutate({ id: rec.id, action: 'approve' })}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={resolveMutation.isPending}
                        onClick={() => setConfirmDialog({ id: rec.id, action: 'reject' })}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!confirmDialog} onOpenChange={(o) => { if (!o) setConfirmDialog(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Early Checkout</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will mark the attendance as absent. Are you sure?</p>
          <Button
            variant="destructive"
            className="w-full"
            disabled={resolveMutation.isPending}
            onClick={() => {
              if (confirmDialog) resolveMutation.mutate({ id: confirmDialog.id, action: 'reject' })
            }}
          >
            {resolveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Rejection
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PendingReviewsTab() {
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [reviewDialog, setReviewDialog] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null)

  const { data: pending, isLoading } = useQuery({
    queryKey: ['attendance', 'regularization', 'pending'],
    queryFn: fetchPendingReviews,
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ request_id, action, comment: c }: { request_id: string; action: 'approve' | 'reject'; comment?: string }) =>
      callEdgeFunction('review-regularization', { request_id, action, comment: c }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', 'regularization'] })
      toast.success('Request reviewed')
      setReviewDialog(null)
      setComment('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Pending Reviews ({pending?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!pending || pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending regularization requests.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((req) => (
                <div key={req.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {req.employee?.first_name} {req.employee?.last_name}
                        <span className="text-muted-foreground font-normal"> ({req.employee?.employee_code})</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Date:</strong> {req.attendance_record?.date ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Current:</strong> {getAttendanceStatusLabel((req.attendance_record?.status ?? '') as AttendanceStatus)}
                        {req.attendance_record?.check_in_time && ` · In: ${new Date(req.attendance_record.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                        {req.attendance_record?.check_out_time && ` · Out: ${new Date(req.attendance_record.check_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                        {req.attendance_record?.total_hours != null && ` · ${formatHours(req.attendance_record.total_hours)}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Requested:</strong> {req.requested_status}
                        {req.requested_check_in && ` · In: ${new Date(req.requested_check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                        {req.requested_check_out && ` · Out: ${new Date(req.requested_check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Reason:</strong> {req.reason}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Submitted: {new Date(req.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        disabled={reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate({ request_id: req.id, action: 'approve' })}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={reviewMutation.isPending}
                        onClick={() => setReviewDialog({ id: req.id, action: 'reject' })}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reviewDialog} onOpenChange={(o) => { if (!o) setReviewDialog(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Comment (optional)</Label>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reason for rejection..." />
            </div>
            <Button
              variant="destructive"
              className="w-full"
              disabled={reviewMutation.isPending}
              onClick={() => {
                if (reviewDialog) reviewMutation.mutate({ request_id: reviewDialog.id, action: 'reject', comment })
              }}
            >
              {reviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function RegularizationPage() {
  const { isOwner, isHR } = useRole()
  const isAdmin = isOwner || isHR

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Attendance Regularization</h1>
        <NewRequestDialog />
      </div>

      {isAdmin ? (
        <Tabs defaultValue={isAdmin ? 'early-checkouts' : 'my'} className="space-y-4">
          <TabsList>
            {(isOwner || isHR) && <TabsTrigger value="early-checkouts">Early Checkouts</TabsTrigger>}
            {(isOwner || isHR) && <TabsTrigger value="pending">Pending Reviews</TabsTrigger>}
            <TabsTrigger value="my">My Requests</TabsTrigger>
          </TabsList>
          {(isOwner || isHR) && (
            <TabsContent value="early-checkouts"><EarlyCheckoutsTab /></TabsContent>
          )}
          {(isOwner || isHR) && (
            <TabsContent value="pending"><PendingReviewsTab /></TabsContent>
          )}
          <TabsContent value="my"><MyRequestsTab /></TabsContent>
        </Tabs>
      ) : (
        <MyRequestsTab />
      )}
    </div>
  )
}
