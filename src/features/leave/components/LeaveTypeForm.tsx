import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import type { LeaveType } from '@/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  leaveType?: LeaveType | null
}

type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say'
type AccrualType = 'monthly' | 'yearly' | 'manual'
type GenderSelect = Gender | 'all'

const defaultForm = {
  name: '',
  code: '',
  accrual_type: 'yearly' as AccrualType,
  accrual_days: 0,
  max_carry_forward_days: 0,
  carry_forward_expiry_days: 0,
  allow_negative_balance: false,
  is_lwp: false,
  requires_attachment: false,
  attachment_required_after_days: 0,
  max_consecutive_days: 0,
  max_per_month: 0,
  min_notice_days: 0,
  applicable_gender: 'all' as GenderSelect,
}

export function LeaveTypeForm({ open, onOpenChange, leaveType }: Props) {
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm)

  useEffect(() => {
    if (leaveType) {
      setForm({
        name: leaveType.name,
        code: leaveType.code,
        accrual_type: leaveType.accrual_type as AccrualType,
        accrual_days: leaveType.accrual_days ?? 0,
        max_carry_forward_days: leaveType.max_carry_forward_days,
        carry_forward_expiry_days: leaveType.carry_forward_expiry_days ?? 0,
        allow_negative_balance: leaveType.allow_negative_balance,
        is_lwp: leaveType.is_lwp,
        requires_attachment: leaveType.requires_attachment,
        attachment_required_after_days: leaveType.attachment_required_after_days ?? 0,
        max_consecutive_days: leaveType.max_consecutive_days ?? 0,
        max_per_month: leaveType.max_per_month ?? 0,
        min_notice_days: leaveType.min_notice_days,
        applicable_gender: (leaveType.applicable_gender ?? 'all') as GenderSelect,
      })
    } else {
      setForm(defaultForm)
    }
  }, [leaveType, open])

  const handleSave = async () => {
    if (!form.name || !form.code) {
      toast.error('Name and code are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        code: form.code,
        accrual_type: form.accrual_type,
        accrual_days: form.accrual_days || null,
        max_carry_forward_days: form.max_carry_forward_days,
        carry_forward_expiry_days: form.carry_forward_expiry_days || null,
        allow_negative_balance: form.allow_negative_balance,
        is_lwp: form.is_lwp,
        requires_attachment: form.requires_attachment,
        attachment_required_after_days: form.attachment_required_after_days || null,
        max_consecutive_days: form.max_consecutive_days || null,
        max_per_month: form.max_per_month || null,
        min_notice_days: form.min_notice_days,
        applicable_gender: form.applicable_gender === 'all' ? null : form.applicable_gender,
      }

      if (leaveType) {
        const { error } = await supabase
          .from('leave_types')
          .update(payload)
          .eq('id', leaveType.id)
        if (error) throw error
        toast.success('Leave type updated')
      } else {
        const { error } = await supabase
          .from('leave_types')
          .insert(payload)
        if (error) throw error
        toast.success('Leave type created')
      }

      qc.invalidateQueries({ queryKey: ['leave', 'types'] })
      onOpenChange(false)
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed to save leave type')
    } finally {
      setSaving(false)
    }
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle>{leaveType ? 'Edit Leave Type' : 'Create Leave Type'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lt-name">Name</Label>
              <Input id="lt-name" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lt-code">Code</Label>
              <Input id="lt-code" value={form.code} onChange={(e) => set('code', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lt-accrual-type">Accrual Type</Label>
              <Select value={form.accrual_type} onValueChange={(v) => set('accrual_type', v as AccrualType)}>
                <SelectTrigger id="lt-accrual-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lt-accrual-days">Accrual Days</Label>
              <Input id="lt-accrual-days" type="number" min={0} value={form.accrual_days} onChange={(e) => set('accrual_days', Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lt-max-cf">Max Carry Forward Days</Label>
              <Input id="lt-max-cf" type="number" min={0} value={form.max_carry_forward_days} onChange={(e) => set('max_carry_forward_days', Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lt-cf-expiry">Carry Forward Expiry Days</Label>
              <Input id="lt-cf-expiry" type="number" min={0} value={form.carry_forward_expiry_days} onChange={(e) => set('carry_forward_expiry_days', Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lt-max-consecutive">Max Consecutive Days</Label>
              <Input id="lt-max-consecutive" type="number" min={0} value={form.max_consecutive_days} onChange={(e) => set('max_consecutive_days', Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lt-min-notice">Min Notice Days</Label>
              <Input id="lt-min-notice" type="number" min={0} value={form.min_notice_days} onChange={(e) => set('min_notice_days', Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lt-max-per-month">Max Per Month (0 = unlimited)</Label>
            <Input id="lt-max-per-month" type="number" min={0} value={form.max_per_month} onChange={(e) => set('max_per_month', Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lt-attachment-after">Attachment Required After Days (0 = never)</Label>
            <Input id="lt-attachment-after" type="number" min={0} value={form.attachment_required_after_days} onChange={(e) => set('attachment_required_after_days', Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label>Applicable Gender</Label>
            <Select value={form.applicable_gender} onValueChange={(v) => set('applicable_gender', v as GenderSelect)}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer Not to Say</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch id="lt-negative" checked={form.allow_negative_balance} onCheckedChange={(v) => set('allow_negative_balance', v)} />
              <Label htmlFor="lt-negative">Allow Negative Balance</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="lt-lwp" checked={form.is_lwp} onCheckedChange={(v) => set('is_lwp', v)} />
              <Label htmlFor="lt-lwp">Is LWP (Loss of Pay)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="lt-attachment" checked={form.requires_attachment} onCheckedChange={(v) => set('requires_attachment', v)} />
              <Label htmlFor="lt-attachment">Requires Attachment</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
