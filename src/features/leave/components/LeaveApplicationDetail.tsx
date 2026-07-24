import { useState } from 'react'
import type { LeaveApplicationWithRelations } from '@/types'
import { useAuthStore } from '@/hooks/useAuth'
import { useCancelLeave, useRequestLeaveCancellation } from '../mutations'
import { getLeaveStatusLabel } from '../utils'
import { getPresignedUrl } from '@/lib/edge'
import { ReviewActions } from './ReviewActions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Props = { application: LeaveApplicationWithRelations }

export function LeaveApplicationDetail({ application }: Props) {
  const employee = useAuthStore((s) => s.employee)
  const cancelLeave = useCancelLeave()
  const requestCancel = useRequestLeaveCancellation()
  const [cancelling, setCancelling] = useState(false)
  const [openingAttachment, setOpeningAttachment] = useState(false)

  const isOwnerHr =
    employee?.role === 'owner' || employee?.role === 'hr'
  const isApplicant = employee?.id === application.employee_id
  const isPending = application.status === 'pending'
  const isApproved = application.status === 'approved'
  const fromDateFuture = isApproved && new Date(application.from_date) > new Date()

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await cancelLeave.mutateAsync({ application_id: application.id })
      toast.success('Leave cancelled')
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed to cancel leave')
    } finally {
      setCancelling(false)
    }
  }

  const handleRequestCancellation = async () => {
    setCancelling(true)
    try {
      await requestCancel.mutateAsync({ application_id: application.id })
      toast.success('Cancellation requested')
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed to request cancellation')
    } finally {
      setCancelling(false)
    }
  }

  const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    approved: 'default',
    rejected: 'destructive',
    cancelled: 'outline',
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leave Application Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Team Member</p>
            <p className="font-medium">
              {application.employee?.first_name} {application.employee?.last_name}
              <br />
              <span className="text-xs text-muted-foreground">
                {application.employee?.employee_code}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Leave Type</p>
            <p className="font-medium">{application.leave_type.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Date Range</p>
            <p className="font-medium">
              {application.from_date} — {application.to_date}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Working Days</p>
            <p className="font-medium">{application.working_days_count}</p>
          </div>
          {(application.lwp_days ?? 0) > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">LWP Days</p>
              <p className="font-medium text-destructive">{application.lwp_days}</p>
            </div>
          )}
          {application.is_half_day && (
            <div>
              <p className="text-xs text-muted-foreground">Half Day</p>
              <p className="font-medium capitalize">
                {application.half_day_period ?? 'Half day'}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={statusVariant[application.status] ?? 'secondary'}>
              {getLeaveStatusLabel(application.status)}
            </Badge>
            {application.cancellation_requested && (
              <Badge variant="outline" className="ml-2">
                Cancellation requested
              </Badge>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Applied At</p>
            <p className="font-medium">
              {new Date(application.applied_at).toLocaleString('en-IN')}
            </p>
          </div>
          {application.reviewed_by && (
            <div>
              <p className="text-xs text-muted-foreground">Reviewed By</p>
              <p className="font-medium">{application.reviewed_by}</p>
            </div>
          )}
          {application.reviewed_at && (
            <div>
              <p className="text-xs text-muted-foreground">Reviewed At</p>
              <p className="font-medium">
                {new Date(application.reviewed_at).toLocaleString('en-IN')}
              </p>
            </div>
          )}
        </div>

        <Separator />

        <div>
          <p className="text-xs text-muted-foreground mb-1">Reason</p>
          <p className="text-sm">{application.reason}</p>
        </div>

        {application.attachment_path && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Attachment</p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-blue-600"
              disabled={openingAttachment}
              onClick={async () => {
                setOpeningAttachment(true)
                try {
                  const { url } = await getPresignedUrl(application.attachment_path!)
                  window.open(url, '_blank', 'noopener,noreferrer')
                } catch {
                  toast.error('Failed to open attachment')
                } finally {
                  setOpeningAttachment(false)
                }
              }}
            >
              {openingAttachment && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              View attachment
            </Button>
          </div>
        )}

        {application.reviewer_comment && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Reviewer Comment</p>
            <p className="text-sm">{application.reviewer_comment}</p>
          </div>
        )}

        {application.cancellation_reason && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Cancellation Reason</p>
            <p className="text-sm">{application.cancellation_reason}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {isPending && isApplicant && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={cancelLeave.isPending || cancelling}
            >
              Cancel Application
            </Button>
          )}

          {fromDateFuture && !application.cancellation_requested && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestCancellation}
              disabled={requestCancel.isPending || cancelling}
            >
              Request Cancellation
            </Button>
          )}

          {application.cancellation_requested && (
            <Badge variant="outline">Cancellation requested</Badge>
          )}

          {isPending && isOwnerHr && (
            <ReviewActions applicationId={application.id} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
