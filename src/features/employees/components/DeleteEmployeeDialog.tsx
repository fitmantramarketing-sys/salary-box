import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useDeleteEmployee } from '@/features/employees/mutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Loader2, Trash2 } from 'lucide-react'
import type { Employee } from '@/types'

type Props = {
  employee: Employee
}

export function DeleteEmployeeDialog({ employee }: Props) {
  const navigate = useNavigate()
  const deleteEmployee = useDeleteEmployee()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')

  const matches = confirmation.trim().toUpperCase() === employee.employee_code.toUpperCase()

  const openDialog = () => {
    setConfirmation('')
    setOpen(true)
  }

  const handleDelete = async () => {
    if (!matches) {
      toast.error('Confirmation does not match the employee code')
      return
    }
    try {
      await deleteEmployee.mutateAsync({ employee_id: employee.id, confirmation: employee.employee_code })
      toast.success(`${employee.first_name} ${employee.last_name} permanently deleted`)
      navigate('/team-members')
    } catch (err: unknown) {
      const error = err as { message?: string }
      toast.error(error.message ?? 'Failed to delete employee')
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" onClick={openDialog}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Permanently
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently Delete {employee.first_name} {employee.last_name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action <strong>cannot be undone</strong>. The employee record, attendance history, leave
            applications, documents, bank details, notifications, and their login account will be permanently
            removed from the system.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-confirm">
            Type the employee code <span className="font-mono font-medium">{employee.employee_code}</span> to
            confirm
          </Label>
          <Input
            id="delete-confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={employee.employee_code}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmation('')}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!matches || deleteEmployee.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteEmployee.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
