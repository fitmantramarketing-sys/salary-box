import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, SendHorizonal } from 'lucide-react'
import { toast } from 'sonner'
import { useRole } from '@/hooks/useRole'
import { useAuthStore } from '@/hooks/useAuth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { getEmployeeFullName, getEmploymentStatusLabel } from '@/features/employees/utils'
import { useSubmitProfileEdit } from '@/features/employees/mutations'
import type { EmployeeWithRelations } from '@/types'

type Props = { employee: EmployeeWithRelations }

function statusVariant(status: string) {
  switch (status) {
    case 'active': return 'default'
    case 'on_probation': return 'secondary'
    case 'future_joiner': return 'outline'
    case 'terminated':
    case 'resigned': return 'destructive'
    default: return 'secondary'
  }
}

export function EmployeeOverviewTab({ employee }: Props) {
  const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase()
  const { isOwner, isHR, role } = useRole()
  const currentEmployee = useAuthStore((s) => s.employee)
  const isOwnProfile = currentEmployee?.id === employee.id
  const canEdit = isOwner || isHR || isOwnProfile
  const reportingManagerName = (() => {
    const rm = employee.reporting_manager
    if (!rm || Array.isArray(rm) || !rm.first_name) return null
    return `${rm.first_name} ${rm.last_name ?? ''}`.trim()
  })()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const submitEdit = useSubmitProfileEdit()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Avatar className="h-16 w-16 shrink-0">
                <AvatarImage src={employee.photo_url ?? undefined} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <CardTitle className="text-xl truncate">{getEmployeeFullName(employee)}</CardTitle>
                <p className="text-sm text-muted-foreground">{employee.employee_code}</p>
                <div className="mt-1 flex gap-2 flex-wrap">
                  <Badge variant={statusVariant(employee.employment_status)}>
                    {getEmploymentStatusLabel(employee.employment_status)}
                  </Badge>
                  <Badge variant="outline">{employee.role}</Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {canEdit && (isOwner || isHR) && (
                <Link to={`/team-members/${employee.id}/edit`}>
                  <Button size="sm" variant="outline" className="w-full sm:w-auto"><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                </Link>
              )}
              {canEdit && role === 'employee' && isOwnProfile && (
                <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => { setEditFields({}); setEditDialogOpen(true) }}>
                  <SendHorizonal className="mr-2 h-4 w-4" />Request Edit
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Personal Info</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{employee.email}</span></div>
            {employee.phone && <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{employee.phone}</span></div>}
            {employee.personal_email && <div className="flex justify-between"><span className="text-muted-foreground">Personal Email</span><span>{employee.personal_email}</span></div>}
            {employee.date_of_birth && <div className="flex justify-between"><span className="text-muted-foreground">DOB</span><span>{employee.date_of_birth}</span></div>}
            {employee.gender && <div className="flex justify-between"><span className="text-muted-foreground">Gender</span><span className="capitalize">{employee.gender}</span></div>}
            {employee.address_line1 && (
              <div>
                <span className="text-muted-foreground">Address</span>
                <p>{employee.address_line1}{employee.city ? `, ${employee.city}` : ''}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Employment Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Department</span>
              <span>{employee.department?.name ?? '—'}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Designation</span>
              <span>{employee.designation?.name ?? '—'}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reporting Manager</span>
              <span className="text-right">{reportingManagerName ?? '—'}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="capitalize">{employee.employment_type.replace('_', ' ')}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Join Date</span>
              <span>{employee.join_date}</span>
            </div>
            {employee.probation_end_date && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Probation End</span>
                  <span>{employee.probation_end_date}</span>
                </div>
              </>
            )}
            {employee.exit_date && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Exit Date</span>
                  <span>{employee.exit_date}</span>
                </div>
              </>
            )}
            {employee.current_salary != null && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Salary</span>
                  <span>₹{employee.current_salary.toLocaleString()}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Profile Edit</DialogTitle>
            <DialogDescription>
              Fill in only the fields you want to change. HR will review your request.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 overflow-y-auto max-h-[55vh] pr-1">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={editFields.phone ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, phone: e.target.value }))} placeholder={employee.phone ?? 'Not set'} />
            </div>
            <div className="space-y-1.5">
              <Label>Personal Email</Label>
              <Input value={editFields.personal_email ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, personal_email: e.target.value }))} placeholder={employee.personal_email ?? 'Not set'} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address Line 1</Label>
              <Input value={editFields.address_line1 ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, address_line1: e.target.value }))} placeholder={employee.address_line1 ?? 'Not set'} />
            </div>
            <div className="space-y-1.5">
              <Label>Address Line 2</Label>
              <Input value={editFields.address_line2 ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, address_line2: e.target.value }))} placeholder={employee.address_line2 ?? 'Not set'} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={editFields.city ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, city: e.target.value }))} placeholder={employee.city ?? 'Not set'} />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input value={editFields.state ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, state: e.target.value }))} placeholder={employee.state ?? 'Not set'} />
            </div>
            <div className="space-y-1.5">
              <Label>Pincode</Label>
              <Input value={editFields.pincode ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, pincode: e.target.value }))} placeholder={employee.pincode ?? 'Not set'} />
            </div>
            <div className="space-y-1.5">
              <Label>Emergency Contact Name</Label>
              <Input value={editFields.emergency_contact_name ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, emergency_contact_name: e.target.value }))} placeholder={employee.emergency_contact_name ?? 'Not set'} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Emergency Contact Phone</Label>
              <Input value={editFields.emergency_contact_phone ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, emergency_contact_phone: e.target.value }))} placeholder={employee.emergency_contact_phone ?? 'Not set'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={Object.keys(editFields).length === 0 || submitEdit.isPending}
              onClick={() => {
                const filled = Object.fromEntries(Object.entries(editFields).filter(([, v]) => v.trim()))
                if (Object.keys(filled).length === 0) {
                  toast.error('Fill in at least one field to request a change')
                  return
                }
                submitEdit.mutate(
                  { employee_id: employee.id, requested_changes: filled },
                  {
                    onSuccess: () => {
                      toast.success('Edit request submitted for HR review')
                      setEditDialogOpen(false)
                    },
                    onError: (err) => {
                      const error = err as { message?: string }
                      toast.error(error.message ?? 'Failed to submit request')
                    },
                  }
                )
              }}
            >
              {submitEdit.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> : 'Submit for Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
