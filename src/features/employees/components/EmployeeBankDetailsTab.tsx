import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/hooks/useRole'
import { useAuthStore } from '@/hooks/useAuth'
import { useEmployeeBankDetails } from '@/features/employees/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Pencil } from 'lucide-react'

type Props = { employeeId: string }

export function EmployeeBankDetailsTab({ employeeId }: Props) {
  const qc = useQueryClient()
  const { isOwner } = useRole()
  const currentEmployee = useAuthStore((s) => s.employee)
  const isOwnProfile = currentEmployee?.id === employeeId
  const canEdit = isOwner || isOwnProfile
  const { data: bankDetails, isLoading } = useEmployeeBankDetails(employeeId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [accountHolder, setAccountHolder] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [bankName, setBankName] = useState('')
  const [saving, setSaving] = useState(false)

  function openEdit() {
    setAccountHolder(bankDetails?.account_holder_name ?? '')
    setAccountNumber('')
    setConfirmAccountNumber('')
    setIfscCode(bankDetails?.ifsc_code ?? '')
    setBankName(bankDetails?.bank_name ?? '')
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!accountHolder.trim()) return toast.error('Account holder name is required')
    if (accountNumber.trim() && accountNumber !== confirmAccountNumber) return toast.error('Account numbers do not match')
    if (!accountNumber.trim()) {
      if (!bankDetails) return toast.error('Account number is required')
      if (!confirmAccountNumber.trim()) return toast.error('Please re-enter the account number to confirm')
    } else if (accountNumber !== confirmAccountNumber) {
      return toast.error('Account numbers do not match')
    }
    if (!ifscCode.trim()) return toast.error('IFSC code is required')
    if (!bankName.trim()) return toast.error('Bank name is required')

    setSaving(true)
    try {
      const finalNumber = accountNumber.trim() || bankDetails!.account_number_encrypted
      const { error } = await supabase.from('employee_bank_details').upsert({
        employee_id: employeeId,
        account_number_encrypted: finalNumber,
        account_number_last4: accountNumber.trim() ? accountNumber.trim().slice(-4) : bankDetails!.account_number_last4,
        ifsc_code: ifscCode.trim().toUpperCase(),
        bank_name: bankName.trim(),
        account_holder_name: accountHolder.trim(),
        is_active: true,
      })
      if (error) throw error

      qc.invalidateQueries({ queryKey: ['employees', 'bank', employeeId] })
      toast.success('Bank details saved')
      setDialogOpen(false)
    } catch (err: unknown) {
      const error = err as { message?: string }
      toast.error(error.message ?? 'Failed to save bank details')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Bank Details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-56" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Bank Details</CardTitle>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" onClick={openEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                {bankDetails ? 'Edit' : 'Add'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{bankDetails ? 'Edit' : 'Add'} Bank Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bank-holder">Account Holder Name</Label>
                  <Input id="bank-holder" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank-number">Account Number</Label>
                  <Input
                    id="bank-number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder={bankDetails ? 'Leave blank to keep existing' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank-number-confirm">Confirm Account Number</Label>
                  <Input
                    id="bank-number-confirm"
                    value={confirmAccountNumber}
                    onChange={(e) => setConfirmAccountNumber(e.target.value)}
                    placeholder={bankDetails ? 'Leave blank to keep existing' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank-ifsc">IFSC Code</Label>
                  <Input id="bank-ifsc" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} placeholder="e.g. HDFC0001234" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank-name">Bank Name</Label>
                  <Input id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!bankDetails ? (
          <p className="text-sm text-muted-foreground">No bank details on file</p>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Holder</span>
              <span className="font-medium">{bankDetails.account_holder_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Number</span>
              <span className="font-mono">XXXX{bankDetails.account_number_last4}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IFSC Code</span>
              <span className="font-mono">{bankDetails.ifsc_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bank Name</span>
              <span>{bankDetails.bank_name}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
