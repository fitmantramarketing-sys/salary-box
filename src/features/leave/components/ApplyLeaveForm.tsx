import { useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { callEdgeFunctionFormData } from '@/lib/edge'
import { useLeaveTypes, useMyLeaveBalances } from '../hooks'
import { useSubmitLeave } from '../mutations'
import { submitLeaveSchema, type SubmitLeaveForm } from '../schemas'
import { getAvailableBalance } from '../utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Paperclip, Loader2, X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export function ApplyLeaveForm() {
  const navigate = useNavigate()
  const { data: leaveTypes, isLoading: typesLoading } = useLeaveTypes()
  const { data: balances, isLoading: balancesLoading } = useMyLeaveBalances(
    new Date().getFullYear()
  )
  const submitLeave = useSubmitLeave()
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [monthlyLimitDialog, setMonthlyLimitDialog] = useState<{
    formData: SubmitLeaveForm
    monthlyConsumed: number
  } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SubmitLeaveForm>({
    resolver: zodResolver(submitLeaveSchema),
    defaultValues: {
      is_half_day: false,
      half_day_period: null,
      attachment_path: null,
    },
  })

  const leaveTypeId = watch('leave_type_id')
  const isHalfDay = watch('is_half_day')

  const selectedBalance = useMemo(() => {
    if (!balances || !leaveTypeId) return null
    return balances.find((b) => b.leave_type_id === leaveTypeId) ?? null
  }, [balances, leaveTypeId])

  const availableBalance = selectedBalance
    ? getAvailableBalance(selectedBalance)
    : 0

  const insufficientBalance =
    selectedBalance && availableBalance <= 0 && !selectedBalance.leave_type.allow_negative_balance

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachmentFile(file)

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      const result = await callEdgeFunctionFormData<{ storage_path: string; file_name: string }>('upload-leave-attachment', formData)
      setAttachmentPath(result.storage_path)
      toast.success('File uploaded')
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed to upload file')
      setAttachmentFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }

  const clearAttachment = () => {
    setAttachmentFile(null)
    setAttachmentPath(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onSubmit = async (data: SubmitLeaveForm, monthlyExcessAction?: 'use_yearly_balance' | 'lwp') => {
    try {
      const payload = { ...data, attachment_path: attachmentPath }
      if (monthlyExcessAction) {
        ;(payload as Record<string, unknown>).monthly_excess_action = monthlyExcessAction
      }
      const result = await submitLeave.mutateAsync(payload)
      toast.success(
        `Leave submitted (${result.working_days_count} working day${result.working_days_count !== 1 ? 's' : ''})`
      )
      navigate('/leave')
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string; details?: { monthly_consumed?: number; monthly_limit?: number } }
      if (err?.code === 'MONTHLY_LIMIT_EXCEEDED') {
        setMonthlyLimitDialog({
          formData: data,
          monthlyConsumed: err.details?.monthly_consumed ?? 0,
        })
        return
      }
      toast.error(err?.message ?? 'Failed to submit leave')
    }
  }

  const handleYearlyBalance = () => {
    if (!monthlyLimitDialog) return
    onSubmit(monthlyLimitDialog.formData, 'use_yearly_balance')
    setMonthlyLimitDialog(null)
  }

  const handleLwp = () => {
    if (!monthlyLimitDialog) return
    onSubmit(monthlyLimitDialog.formData, 'lwp')
    setMonthlyLimitDialog(null)
  }

  if (typesLoading || balancesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apply for Leave</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Apply for Leave</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="leave_type_id">Leave Type</Label>
            <Select
              onValueChange={(v) => setValue('leave_type_id', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes?.map((lt) => {
                  const bal = balances?.find((b) => b.leave_type_id === lt.id)
                  const avail = bal ? getAvailableBalance(bal) : 0
                  return (
                    <SelectItem key={lt.id} value={lt.id}>
                      {lt.name} ({avail} available)
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {errors.leave_type_id && (
              <p className="text-sm text-destructive">{errors.leave_type_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from_date">From Date</Label>
              <Input id="from_date" type="date" {...register('from_date')} />
              {errors.from_date && (
                <p className="text-sm text-destructive">{errors.from_date.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="to_date">To Date</Label>
              <Input id="to_date" type="date" {...register('to_date')} />
              {errors.to_date && (
                <p className="text-sm text-destructive">{errors.to_date.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="is_half_day"
                checked={isHalfDay}
                onCheckedChange={(v) => setValue('is_half_day', v)}
              />
              <Label htmlFor="is_half_day">Half Day</Label>
            </div>
            {isHalfDay && (
              <Select
                onValueChange={(v) =>
                  setValue('half_day_period', v as 'morning' | 'afternoon', { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              rows={4}
              placeholder="Provide a reason for leave (min 5 characters)"
              {...register('reason')}
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason.message}</p>
            )}
          </div>

          {selectedBalance && (
            <div
              className={`rounded border p-3 text-sm ${
                insufficientBalance
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : availableBalance <= 0
                    ? 'border-yellow-200 bg-yellow-50 text-yellow-700'
                    : 'border-green-200 bg-green-50 text-green-700'
              }`}
            >
              <span className="font-medium">{selectedBalance.leave_type.name}</span>:{' '}
              {availableBalance} available
              {insufficientBalance &&
                ' — insufficient balance (submission still allowed for this leave type)'}
            </div>
          )}

          <div className="space-y-2">
            <Label>Attachment</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
                {attachmentFile ? 'Change File' : 'Attach File'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleFileChange}
              />
              {attachmentFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="truncate max-w-[200px]">{attachmentFile.name}</span>
                  <button type="button" onClick={clearAttachment} className="text-destructive hover:text-destructive/80">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={submitLeave.isPending || uploading || !!insufficientBalance}
          >
            {submitLeave.isPending ? 'Submitting...' : 'Submit Leave'}
          </Button>
        </form>
      </CardContent>
    </Card>

      <Dialog open={!!monthlyLimitDialog} onOpenChange={(open) => { if (!open) setMonthlyLimitDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Monthly Leave Limit Exceeded</DialogTitle>
            <DialogDescription>
              You can take a maximum of 2 paid leaves per month. You've already used {monthlyLimitDialog?.monthlyConsumed ?? 0} paid leave day(s) this month.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-center">
            <Button variant="outline" onClick={handleYearlyBalance}>
              Use Yearly Balance
            </Button>
            <Button onClick={handleLwp}>
              Mark Excess as LWP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
