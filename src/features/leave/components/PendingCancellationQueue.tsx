import { useState } from 'react'
import { useCancellationRequests } from '../hooks'
import { useConfirmLeaveCancellation } from '../mutations'
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
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export function PendingCancellationQueue() {
  const { data: cancellations, isLoading } = useCancellationRequests()
  const confirmCancel = useConfirmLeaveCancellation()

  const [target, setTarget] = useState<{
    id: string
    action: 'confirm' | 'reject'
  } | null>(null)
  const [comment, setComment] = useState('')

  const handleAction = async () => {
    if (!target) return
    try {
      await confirmCancel.mutateAsync({
        application_id: target.id,
        action: target.action,
        comment: comment || undefined,
      })
      toast.success(
        target.action === 'confirm'
          ? 'Cancellation confirmed'
          : 'Cancellation rejected'
      )
      setTarget(null)
      setComment('')
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed to process cancellation')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  if (!cancellations || cancellations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No pending cancellation requests
        </CardContent>
      </Card>
    )
  }

  return (
    <>
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
                <TableRow key={app.id}>
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
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() =>
                          setTarget({ id: app.id, action: 'confirm' })
                        }
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setTarget({ id: app.id, action: 'reject' })
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

      <Dialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null)
            setComment('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {target?.action === 'confirm' ? 'Confirm' : 'Reject'} Cancellation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="cancel-comment">Comment (optional)</Label>
            <Textarea
              id="cancel-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTarget(null)
                setComment('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant={target?.action === 'confirm' ? 'default' : 'destructive'}
              onClick={handleAction}
              disabled={confirmCancel.isPending}
            >
              {target?.action === 'confirm' ? 'Confirm' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
