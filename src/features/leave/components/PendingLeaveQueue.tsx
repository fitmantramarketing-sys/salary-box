import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePendingLeaveApplications, useCancellationRequests } from '../hooks'
import { useReviewLeave, useConfirmLeaveCancellation } from '../mutations'
import { getPresignedUrl } from '@/lib/edge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, Paperclip } from 'lucide-react'
import { toast } from 'sonner'

export function PendingLeaveQueue() {
  const navigate = useNavigate()
  const { data: pending, isLoading: loadingPending, error: pendingError } = usePendingLeaveApplications()
  const { data: cancellations, isLoading: loadingCancellations, error: cancellationsError } = useCancellationRequests()
  const [openingAttachments, setOpeningAttachments] = useState<Set<string>>(new Set())

  const reviewLeave = useReviewLeave()
  const confirmCancel = useConfirmLeaveCancellation()

  const [reviewTarget, setReviewTarget] = useState<{
    id: string
    action: 'approve' | 'reject'
  } | null>(null)
  const [reviewComment, setReviewComment] = useState('')

  const [cancelTarget, setCancelTarget] = useState<{
    id: string
    action: 'confirm' | 'reject'
  } | null>(null)
  const [cancelComment, setCancelComment] = useState('')

  const handleReview = async () => {
    if (!reviewTarget) return
    try {
      await reviewLeave.mutateAsync({
        application_id: reviewTarget.id,
        action: reviewTarget.action,
        comment: reviewComment || undefined,
      })
      toast.success(`Leave ${reviewTarget.action === 'approve' ? 'approved' : 'rejected'}`)
      setReviewTarget(null)
      setReviewComment('')
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Review failed')
    }
  }

  const handleCancelReview = async () => {
    if (!cancelTarget) return
    try {
      await confirmCancel.mutateAsync({
        application_id: cancelTarget.id,
        action: cancelTarget.action,
        comment: cancelComment || undefined,
      })
      toast.success(
        cancelTarget.action === 'confirm'
          ? 'Cancellation confirmed'
          : 'Cancellation rejected'
      )
      setCancelTarget(null)
      setCancelComment('')
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed to process cancellation')
    }
  }

  return (
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending">Pending Leaves</TabsTrigger>
        <TabsTrigger value="cancellations">Cancellation Requests</TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="mt-4">
        {loadingPending ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : pendingError ? (
          <Card>
            <CardContent className="py-8 text-center text-destructive">
              Failed to load pending leaves. Please try again.
            </CardContent>
          </Card>
        ) : !pending || pending.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No pending leave applications
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending Leave Applications</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Member</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Att.</TableHead>
                    <TableHead>Applied At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((app) => (
                    <TableRow
                      key={app.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/leave/applications/${app.id}`)}
                    >
                      <TableCell className="font-medium">
                        {app.employee?.first_name} {app.employee?.last_name}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {app.employee?.employee_code}
                        </span>
                      </TableCell>
                      <TableCell>{app.leave_type.name}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {app.from_date} — {app.to_date}
                      </TableCell>
                      <TableCell>{app.working_days_count}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {app.reason}
                      </TableCell>
                      <TableCell className="text-center">
                        {app.attachment_path ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            disabled={openingAttachments.has(app.id)}
                            onClick={async (e) => {
                              e.stopPropagation()
                              setOpeningAttachments((prev) => new Set(prev).add(app.id))
                              try {
                                const { url } = await getPresignedUrl(app.attachment_path!)
                                window.open(url, '_blank', 'noopener,noreferrer')
                              } catch {
                                toast.error('Failed to open attachment')
                              } finally {
                                setOpeningAttachments((prev) => {
                                  const next = new Set(prev)
                                  next.delete(app.id)
                                  return next
                                })
                              }
                            }}
                          >
                            {openingAttachments.has(app.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Paperclip className="h-3 w-3" />
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(app.applied_at).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => setReviewTarget({ id: app.id, action: 'approve' })}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setReviewTarget({ id: app.id, action: 'reject' })}
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="cancellations" className="mt-4">
        {loadingCancellations ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : cancellationsError ? (
          <Card>
            <CardContent className="py-8 text-center text-destructive">
              Failed to load cancellation requests. Please try again.
            </CardContent>
          </Card>
        ) : !cancellations || cancellations.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No pending cancellation requests
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cancellation Requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Member</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Reason for Cancellation</TableHead>
                    <TableHead>Applied At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cancellations.map((app) => (
                    <TableRow
                      key={app.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/leave/applications/${app.id}`)}
                    >
                      <TableCell className="font-medium">
                        {app.employee?.first_name} {app.employee?.last_name}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {app.employee?.employee_code}
                        </span>
                      </TableCell>
                      <TableCell>{app.leave_type.name}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {app.from_date} — {app.to_date}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {app.cancellation_reason ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(app.applied_at).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() =>
                              setCancelTarget({ id: app.id, action: 'confirm' })
                            }
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setCancelTarget({ id: app.id, action: 'reject' })
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <Dialog
        open={!!reviewTarget}
        onOpenChange={(open) => {
          if (!open) {
            setReviewTarget(null)
            setReviewComment('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewTarget?.action === 'approve' ? 'Approve' : 'Reject'} Leave
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="review-comment">Comment (optional)</Label>
            <Textarea
              id="review-comment"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Add a comment..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewTarget(null)
                setReviewComment('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant={reviewTarget?.action === 'approve' ? 'default' : 'destructive'}
              onClick={handleReview}
              disabled={reviewLeave.isPending}
            >
              {reviewTarget?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null)
            setCancelComment('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cancelTarget?.action === 'confirm' ? 'Confirm' : 'Reject'} Cancellation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="cancel-comment">Comment (optional)</Label>
            <Textarea
              id="cancel-comment"
              value={cancelComment}
              onChange={(e) => setCancelComment(e.target.value)}
              placeholder="Add a comment..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelTarget(null)
                setCancelComment('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant={cancelTarget?.action === 'confirm' ? 'default' : 'destructive'}
              onClick={handleCancelReview}
              disabled={confirmCancel.isPending}
            >
              {cancelTarget?.action === 'confirm' ? 'Confirm' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  )
}
