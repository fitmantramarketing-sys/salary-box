import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEmployee } from '@/features/employees/hooks'
import { AttendanceCalendar } from '@/features/attendance/components/AttendanceCalendar'
import { AttendanceSummaryCards } from '@/features/attendance/components/AttendanceSummaryCards'
import { fetchMyAttendance } from '@/features/attendance/api'
import {
  manualAttendanceSchema,
  type ManualAttendanceForm,
} from '@/features/attendance/schemas'
import { callEdgeFunction } from '@/lib/edge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TimePicker } from '@/components/ui/TimePicker'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, ArrowLeft, Plus } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'absent', label: 'Absent' },
  { value: 'wfh', label: 'WFH' },
] as const

type EntryType = 'present' | 'half_day' | 'absent' | 'wfh' | null

export default function EmployeeAttendanceDrillDownPage() {
  const { employeeId } = useParams<{ employeeId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [entryType, setEntryType] = useState<EntryType>(null)

  const { data: employee, isLoading: empLoading } = useEmployee(employeeId ?? '')

  const { data: records, isLoading: recLoading } = useQuery({
    queryKey: ['attendance', 'employee', employeeId, year, month],
    queryFn: () => fetchMyAttendance(employeeId!, year, month),
    enabled: !!employeeId,
  })

  const manualMutation = useMutation({
    mutationFn: (body: ManualAttendanceForm) =>
      callEdgeFunction<ManualAttendanceForm, { attendance_record_id: string; status: string; total_hours: number | null }>('manual-attendance', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', 'employee', employeeId] })
      toast.success('Manual attendance recorded')
      setDialogOpen(false)
      form.reset()
      setEntryType(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const form = useForm<ManualAttendanceForm>({
    resolver: zodResolver(manualAttendanceSchema),
    defaultValues: { employee_id: employeeId ?? '', date: '', reason: '', is_wfh: false },
  })

  const showTimes = entryType === 'present' || entryType === 'half_day'

  const handleManualEntry = (date: string) => {
    form.setValue('date', date)
    setEntryType(null)
    setDialogOpen(true)
  }

  const onSubmit = async (values: ManualAttendanceForm) => {
    if (!entryType) {
      toast.error('Select a status type')
      return
    }
    const checkInIso = values.check_in_time && values.date
      ? new Date(`${values.date}T${values.check_in_time}`).toISOString()
      : undefined
    const checkOutIso = values.check_out_time && values.date
      ? new Date(`${values.date}T${values.check_out_time}`).toISOString()
      : undefined
    const payload = {
      employee_id: values.employee_id,
      date: values.date,
      reason: values.reason,
      check_in_time: checkInIso,
      check_out_time: checkOutIso,
      is_wfh: entryType === 'wfh',
      manual_status: entryType === 'wfh' ? undefined : entryType,
    }
    manualMutation.mutate(payload as unknown as ManualAttendanceForm)
  }

  if (empLoading || recLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  if (employee?.role === 'owner') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">Attendance not tracked for this user</p>
        <p className="text-sm">Owner attendance data is not available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">
              {employee?.first_name} {employee?.last_name}
            </h1>
            <p className="text-sm text-muted-foreground">{employee?.employee_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else { setMonth(m => m - 1) } }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <Button variant="outline" size="icon" onClick={() => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else { setMonth(m => m + 1) } }}>
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Manual Entry</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Manual Attendance Entry</DialogTitle></DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" {...form.register('date')} />
                  {form.formState.errors.date && <p className="text-xs text-red-500">{form.formState.errors.date.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {STATUS_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={entryType === opt.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setEntryType(opt.value)
                          form.setValue('is_wfh', opt.value === 'wfh')
                        }}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  {form.formState.errors.manual_status && (
                    <p className="text-xs text-red-500">{form.formState.errors.manual_status.message}</p>
                  )}
                </div>
                {showTimes && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Check-in <span className="text-xs text-muted-foreground">(optional)</span></Label>
                      <TimePicker
                        value={form.watch('check_in_time')}
                        onChange={(v) => form.setValue('check_in_time', v)}
                      />
                      {form.formState.errors.check_in_time && <p className="text-xs text-red-500">{form.formState.errors.check_in_time.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Check-out <span className="text-xs text-muted-foreground">(optional)</span></Label>
                      <TimePicker
                        value={form.watch('check_out_time')}
                        onChange={(v) => form.setValue('check_out_time', v)}
                      />
                      {form.formState.errors.check_out_time && <p className="text-xs text-red-500">{form.formState.errors.check_out_time.message}</p>}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea {...form.register('reason')} placeholder="Why was this entered manually?" />
                  {form.formState.errors.reason && <p className="text-xs text-red-500">{form.formState.errors.reason.message}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={manualMutation.isPending || !entryType}>
                  {manualMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Entry
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <AttendanceCalendar
        records={records}
        year={year}
        month={month}
        onPrevMonth={() => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else { setMonth(m => m - 1) } }}
        onNextMonth={() => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else { setMonth(m => m + 1) } }}
        onManualEntry={handleManualEntry}
      />
      <AttendanceSummaryCards records={records} />
    </div>
  )
}
