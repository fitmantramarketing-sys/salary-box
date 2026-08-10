import { useState } from 'react'
import { toast } from 'sonner'
import { useChangeLoginEmail } from '@/features/employees/mutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Mail } from 'lucide-react'
import type { Employee } from '@/types'

type Props = {
  employee: Employee
}

export function ChangeLoginEmailDialog({ employee }: Props) {
  const changeEmail = useChangeLoginEmail()
  const [open, setOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')

  const openDialog = () => {
    setNewEmail('')
    setOpen(true)
  }

  const handleSubmit = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) {
      toast.error('New email is required')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email address')
      return
    }
    if (email === employee.email.toLowerCase()) {
      toast.error('New email is the same as the current email')
      return
    }
    try {
      await changeEmail.mutateAsync({ employee_id: employee.id, new_email: email })
      toast.success(`Login email changed to ${email}`)
      setOpen(false)
    } catch (err: unknown) {
      const error = err as { message?: string }
      toast.error(error.message ?? 'Failed to change login email')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={openDialog}>
          <Mail className="mr-2 h-4 w-4" />
          Change Login Email
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Login Email</DialogTitle>
          <DialogDescription>
            {employee.first_name} {employee.last_name} will keep the same account, but must sign in with the new
            email. Password reset and notification emails will be sent to the new address.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Current login email:</span>{' '}
              <span className="font-medium">{employee.email}</span>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-email">New Login Email</Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The employee will be notified at the new email address.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={changeEmail.isPending}>
              {changeEmail.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change Email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
