import { useState, useEffect, useRef } from 'react'
import { useTodayAttendance } from '../hooks'
import { useCheckIn, useCheckOut, useLogWFH } from '../mutations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Clock, LogOut, Home, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { formatHours, getCurrentPosition, getCurrentPositionQuick } from '../utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

export function CheckInOutCard() {
  const { data: today, isLoading, refetch } = useTodayAttendance()
  const checkIn = useCheckIn()
  const checkOut = useCheckOut()
  const logWFH = useLogWFH()

  const [lateWarning, setLateWarning] = useState<{ count: number; threshold: number } | null>(null)
  const [earlyCheckoutOpen, setEarlyCheckoutOpen] = useState(false)
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState('')
  const [wfhDialogOpen, setWfhDialogOpen] = useState(false)

  // Auto check-in when GPS shows we're inside the office geofence
  const autoCheckInAttempted = useRef(false)
  useEffect(() => {
    if (isLoading || !today || today.check_in_time || autoCheckInAttempted.current) return
    autoCheckInAttempted.current = true
    ;(async () => {
      try {
        const coords = await getCurrentPositionQuick()
        if (!coords) return
        await checkIn.mutateAsync(coords)
        toast.success('Auto checked in')
        refetch()
      } catch {
        // silent — user can tap the button
      }
    })()
  }, [isLoading, today, checkIn, refetch])

  const handleCheckIn = async () => {
    try {
      const coords = await getCurrentPosition()
      const result = await checkIn.mutateAsync(coords)
      toast.success(result.is_late ? 'Checked in — late' : 'Checked in successfully')
      if (result.status === 'half_day') {
        toast.info('Half-day: check-in was well after shift start')
      }
      if (result.late_count_this_month != null && result.late_threshold != null) {
        const remaining = result.late_threshold - (result.late_count_this_month - 1)
        if (remaining <= 1) {
          setLateWarning({ count: result.late_count_this_month, threshold: result.late_threshold })
        }
      }
      refetch()
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Check-in failed')
    }
  }

  const handleCheckOutClick = async () => {
    try {
      const coords = await getCurrentPosition()
      const result = await checkOut.mutateAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      })
      toast.success(`Checked out. Total: ${formatHours(result.total_hours)}`)
      refetch()
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string }
      if (err?.code === 'VALIDATION_ERROR' && err?.message?.toLowerCase().includes('early_checkout_reason')) {
        // Server says it's early — show dialog to collect reason
        setEarlyCheckoutReason('')
        setEarlyCheckoutOpen(true)
      } else {
        toast.error(err?.message ?? 'Check-out failed')
      }
    }
  }

  const handleCheckOutConfirm = async () => {
    if (!earlyCheckoutReason.trim()) {
      toast.error('Please provide a reason for early checkout')
      return
    }
    try {
      const coords = await getCurrentPosition()
      const result = await checkOut.mutateAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
        early_checkout_reason: earlyCheckoutReason.trim(),
      })
      setEarlyCheckoutOpen(false)
      toast.success(`Checked out. Total: ${formatHours(result.total_hours)}`)
      refetch()
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Check-out failed')
    }
  }

  const handleLogWFHClick = () => setWfhDialogOpen(true)

  const handleLogWFHConfirm = async () => {
    try {
      await logWFH.mutateAsync()
      setWfhDialogOpen(false)
      toast.success('WFH logged for today')
      refetch()
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed to log WFH')
    }
  }

  const checkedIn = !!today?.check_in_time
  const checkedOut = !!today?.check_out_time
  const isWFH = today?.is_wfh ?? false

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Today</CardTitle></CardHeader>
        <CardContent className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Today</span>
            {checkedIn && today?.check_in_time && (
              <span className="text-sm font-normal text-muted-foreground">
                {new Date(today.check_in_time).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {checkedOut && today?.check_out_time && ` — ${new Date(today.check_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                {!checkedOut && ' — In progress'}
                {today.total_hours != null && ` (${formatHours(today.total_hours)})`}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {lateWarning && (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                ⚠️ Late marks this month: {lateWarning.count}/{lateWarning.threshold}. One more will trigger a leave deduction.
              </span>
              <button className="ml-auto font-medium hover:underline" onClick={() => setLateWarning(null)}>Dismiss</button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
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
              {checkOut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
              Check Out
            </Button>
            <Button
              size="lg"
              variant="secondary"
              disabled={checkedIn || isWFH || logWFH.isPending}
              onClick={handleLogWFHClick}
            >
              {logWFH.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Home className="mr-2 h-4 w-4" />}
              {isWFH ? 'WFH Logged' : 'Log WFH'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={wfhDialogOpen} onOpenChange={setWfhDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Work From Home</DialogTitle>
            <DialogDescription>
              Are you working from home today? This will mark your entire day as WFH.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWfhDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleLogWFHConfirm}>Confirm WFH</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  )
}
