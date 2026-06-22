import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useHolidays, useMyOptionalHolidays } from '../hooks'
import { useOptInHoliday, useOptOutHoliday } from '../mutations'
import { useRole } from '@/hooks/useRole'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { Holiday } from '@/types'

type HolidayType = 'national' | 'state' | 'company' | 'optional'

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function HolidayList() {
  const year = new Date().getFullYear()
  const { data: holidays, isLoading } = useHolidays(year)
  const { data: optedHolidays } = useMyOptionalHolidays()
  const { isAdminOrHR } = useRole()
  const optIn = useOptInHoliday()
  const optOut = useOptOutHoliday()
  const qc = useQueryClient()

  const isOpted = (holidayId: string) =>
    optedHolidays?.some((oh) => oh.holiday_id === holidayId) ?? false

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Holiday | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null)

  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formType, setFormType] = useState<HolidayType>('national')
  const [formOptional, setFormOptional] = useState(false)

  const [saving, setSaving] = useState(false)

  const grouped = useMemo(() => {
    if (!holidays) return []
    const groups: { month: number; holidays: Holiday[] }[] = []
    for (let m = 0; m < 12; m++) {
      const h = holidays.filter((h) => new Date(h.date).getMonth() === m)
      if (h.length > 0) groups.push({ month: m, holidays: h })
    }
    return groups
  }, [holidays])

  const openCreate = () => {
    setEditing(null)
    setFormName('')
    setFormDate('')
    setFormType('national')
    setFormOptional(false)
    setDialogOpen(true)
  }

  const openEdit = (h: Holiday) => {
    setEditing(h)
    setFormName(h.name)
    setFormDate(h.date)
    setFormType(h.type as HolidayType)
    setFormOptional(h.is_optional)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName || !formDate) {
      toast.error('Name and date are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: formName,
        date: formDate,
        year: new Date(formDate).getFullYear(),
        type: formType,
        is_optional: formOptional,
      }

      if (editing) {
        const { error } = await supabase.from('holidays').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success('Holiday updated')
      } else {
        const { error } = await supabase.from('holidays').insert(payload)
        if (error) throw error
        toast.success('Holiday created')
      }

      qc.invalidateQueries({ queryKey: ['leave', 'holidays'] })
      setDialogOpen(false)
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed to save holiday')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const { error } = await supabase.from('holidays').delete().eq('id', deleteTarget.id)
      if (error) throw error
      toast.success('Holiday deleted')
      qc.invalidateQueries({ queryKey: ['leave', 'holidays'] })
      setDeleteTarget(null)
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed to delete holiday')
    }
  }

  const handleOptToggle = async (holidayId: string, opted: boolean) => {
    try {
      if (opted) {
        await optOut.mutateAsync({ holiday_id: holidayId })
        toast.success('Opted out of holiday')
      } else {
        await optIn.mutateAsync({ holiday_id: holidayId })
        toast.success('Opted into holiday')
      }
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed to update holiday preference')
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holidays {year}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!holidays || holidays.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Holidays {year}</CardTitle>
          {isAdminOrHR && (
            <Button size="sm" onClick={openCreate}>Add Holiday</Button>
          )}
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          No holidays configured for {year}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Holidays {year}</CardTitle>
          {isAdminOrHR && (
            <Button size="sm" onClick={openCreate}>Add Holiday</Button>
          )}
        </CardHeader>
        <CardContent>
          {grouped.map((g) => (
            <div key={g.month} className="mb-6 last:mb-0">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                {monthNames[g.month]}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Optional</TableHead>
                    {isAdminOrHR && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.holidays.map((h) => {
                    const opted = isOpted(h.id)
                    return (
                      <TableRow key={h.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </TableCell>
                        <TableCell className="font-medium">{h.name}</TableCell>
                        <TableCell className="capitalize">{h.type}</TableCell>
                        <TableCell>
                          <Badge variant={h.is_optional ? 'default' : 'secondary'}>
                            {h.is_optional ? 'Yes' : 'No'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {h.is_optional && !isAdminOrHR && (
                            <Button
                              size="sm"
                              variant={opted ? 'outline' : 'default'}
                              onClick={() => handleOptToggle(h.id, opted)}
                              disabled={optIn.isPending || optOut.isPending}
                            >
                              {opted ? 'Opt Out' : 'Opt In'}
                            </Button>
                          )}
                          {isAdminOrHR && (
                            <div className="flex gap-1">
                              {h.is_optional && (
                                <Button
                                  size="sm"
                                  variant={opted ? 'outline' : 'default'}
                                  onClick={() => handleOptToggle(h.id, opted)}
                                  disabled={optIn.isPending || optOut.isPending}
                                >
                                  {opted ? 'Opt Out' : 'Opt In'}
                                </Button>
                              )}
                              <Button size="sm" variant="outline" onClick={() => openEdit(h)}>Edit</Button>
                              <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(h)}>Delete</Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hol-name">Holiday Name</Label>
              <Input id="hol-name" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hol-date">Date</Label>
              <Input id="hol-date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hol-type">Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as HolidayType)}>
                <SelectTrigger id="hol-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="national">National</SelectItem>
                  <SelectItem value="state">State</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="optional">Optional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="hol-optional" checked={formOptional} onCheckedChange={setFormOptional} />
              <Label htmlFor="hol-optional">Is Optional</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Holiday</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
