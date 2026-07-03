import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, Edit2, Trash2, Star, Building2, User } from 'lucide-react'
import type { Shift, DepartmentShift, EmployeeShiftOverride, Department } from '@/types'

type ShiftWithDepts = Shift & { departmentCount?: number; employeeOverrideCount?: number }

async function fetchShiftsWithCounts(): Promise<ShiftWithDepts[]> {
  const { data: shifts, error } = await supabase.from('shifts').select('*').eq('is_active', true).order('name')
  if (error) throw error

  const { data: deptShifts } = await supabase.from('department_shifts').select('shift_id')
  const { data: overrides } = await supabase.from('employee_shift_overrides').select('shift_id')

  const deptCounts = new Map<string, number>()
  const overrideCounts = new Map<string, number>()
  if (deptShifts) for (const d of deptShifts) deptCounts.set(d.shift_id, (deptCounts.get(d.shift_id) ?? 0) + 1)
  if (overrides) for (const o of overrides) overrideCounts.set(o.shift_id, (overrideCounts.get(o.shift_id) ?? 0) + 1)

  return (shifts ?? []).map((s) => ({
    ...s,
    departmentCount: deptCounts.get(s.id) ?? 0,
    employeeOverrideCount: overrideCounts.get(s.id) ?? 0,
  }))
}

async function fetchDepartments() {
  const { data, error } = await supabase.from('departments').select('*').eq('is_active', true).order('name')
  if (error) throw error
  return data as Department[]
}

async function fetchDeptAssignments() {
  const { data, error } = await supabase
    .from('department_shifts')
    .select('*, shift:shifts!shift_id(name), department:departments!department_id(name)')
    .order('effective_from', { ascending: false })
  if (error) throw error
  return data as (DepartmentShift & { shift: { name: string }; department: { name: string } })[]
}

async function fetchEmployeeOverrides() {
  const { data, error } = await supabase
    .from('employee_shift_overrides')
    .select('*, shift:shifts!shift_id(name), employee:employees!employee_id(first_name, last_name, employee_code)')
    .order('effective_from', { ascending: false })
  if (error) throw error
  return data as (EmployeeShiftOverride & { shift: { name: string }; employee: { first_name: string; last_name: string; employee_code: string } })[]
}

async function fetchEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select('id, first_name, last_name, employee_code')
    .eq('is_active', true)
    .order('first_name')
  if (error) throw error
  return data
}

/* ─── Shift Form Dialog ──────────────────────────────────────────────────── */

function ShiftDialog({
  open,
  onOpenChange,
  editingShift,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editingShift: Shift | null
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(editingShift?.name ?? '')
  const [startTime, setStartTime] = useState(editingShift?.start_time ?? '09:00')
  const [endTime, setEndTime] = useState(editingShift?.end_time ?? '18:00')
  const [gracePeriod, setGracePeriod] = useState(String(editingShift?.grace_period_minutes ?? 15))
  const [breakMinutes, setBreakMinutes] = useState(String(editingShift?.break_minutes ?? 60))
  const [weeklyOff, setWeeklyOff] = useState<string[]>(
    (editingShift?.weekly_off_days ?? [0]).map(String)
  )
  const [nightShift, setNightShift] = useState(editingShift?.is_night_shift ?? false)
  const [lateThreshold, setLateThreshold] = useState(String(editingShift?.late_mark_threshold ?? 3))
  const [satEnabled, setSatEnabled] = useState(!!editingShift?.saturday_start_time)
  const [satStartTime, setSatStartTime] = useState(editingShift?.saturday_start_time ?? '10:00')
  const [satEndTime, setSatEndTime] = useState(editingShift?.saturday_end_time ?? '16:00')

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        start_time: startTime,
        end_time: endTime,
        grace_period_minutes: parseInt(gracePeriod),
        break_minutes: parseInt(breakMinutes),
        weekly_off_days: weeklyOff.map(Number),
        is_night_shift: nightShift,
        late_mark_threshold: parseInt(lateThreshold),
        saturday_start_time: satEnabled ? satStartTime : null,
        saturday_end_time: satEnabled ? satEndTime : null,
      }
      if (editingShift) {
        const { error } = await supabase.from('shifts').update(payload).eq('id', editingShift.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('shifts').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] })
      toast.success(editingShift ? 'Shift updated' : 'Shift created')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const days = [0, 1, 2, 3, 4, 5, 6]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editingShift ? 'Edit Shift' : 'Add Shift'}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
          <div className="space-y-2">
            <Label>Shift Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning Shift" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={satEnabled} onCheckedChange={setSatEnabled} />
            <Label>Different timings on Saturday</Label>
          </div>
          {satEnabled && (
            <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-primary/20">
              <div className="space-y-2">
                <Label>Saturday Start Time</Label>
                <Input type="time" value={satStartTime} onChange={(e) => setSatStartTime(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Saturday End Time</Label>
                <Input type="time" value={satEndTime} onChange={(e) => setSatEndTime(e.target.value)} required />
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Grace Period (min)</Label>
              <Input type="number" value={gracePeriod} onChange={(e) => setGracePeriod(e.target.value)} min="0" />
            </div>
            <div className="space-y-2">
              <Label>Break (min)</Label>
              <Input type="number" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} min="0" />
            </div>
            <div className="space-y-2">
              <Label>Late Threshold</Label>
              <Input type="number" value={lateThreshold} onChange={(e) => setLateThreshold(e.target.value)} min="1" />
              <p className="text-[10px] text-muted-foreground">Marks before deduction</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Weekly Off Days</Label>
            <div className="flex flex-wrap gap-2">
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setWeeklyOff((prev) => prev.includes(String(d)) ? prev.filter((x) => x !== String(d)) : [...prev, String(d)])}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    weeklyOff.includes(String(d))
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-input hover:bg-accent'
                  }`}
                >
                  {dayNames[d]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={nightShift} onCheckedChange={setNightShift} />
            <Label>Night Shift</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingShift ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Department Assignment Dialog ───────────────────────────────────────── */

function DepartmentAssignmentDialog({
  shifts,
}: {
  shifts: ShiftWithDepts[]
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0])

  const { data: departments } = useQuery({
    queryKey: ['departments', 'active'],
    queryFn: fetchDepartments,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('department_shifts').insert({
        shift_id: selectedShift,
        department_id: selectedDept,
        effective_from: effectiveFrom,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dept-shifts'] })
      qc.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Department assigned to shift')
      setOpen(false)
      setSelectedShift('')
      setSelectedDept('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="mr-2 h-4 w-4" />Assign Department</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign Department to Shift</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
          <div className="space-y-2">
            <Label>Shift</Label>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
              <SelectContent>
                {shifts.filter((s) => s.is_active).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.start_time}-{s.end_time})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {departments?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Effective From</Label>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={!selectedShift || !selectedDept || mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Employee Override Dialog ───────────────────────────────────────────── */

function EmployeeOverrideDialog({ shifts }: { shifts: ShiftWithDepts[] }) {
  const qc = useQueryClient()
  const actor = useAuthStore((s) => s.employee)
  const [open, setOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState('')
  const [selectedEmp, setSelectedEmp] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')

  const { data: employees } = useQuery({
    queryKey: ['employees', 'active-list'],
    queryFn: fetchEmployees,
  })

  const filtered = employees?.filter((e) =>
    `${e.first_name} ${e.last_name} ${e.employee_code}`.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('employee_shift_overrides').insert({
        shift_id: selectedShift,
        employee_id: selectedEmp,
        assigned_by: actor!.id,
        effective_from: effectiveFrom,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emp-overrides'] })
      qc.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Employee override assigned')
      setOpen(false)
      setSelectedShift('')
      setSelectedEmp('')
      setSearch('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="mr-2 h-4 w-4" />Add Override</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Employee Shift Override</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
          <div className="space-y-2">
            <Label>Shift</Label>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
              <SelectContent>
                {shifts.filter((s) => s.is_active).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.start_time}-{s.end_time})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Employee</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees..." className="mb-2" />
            <div className="max-h-40 overflow-y-auto rounded border">
              {filtered.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">No employees found</p>
              ) : (
                filtered.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => { setSelectedEmp(e.id); setSearch(`${e.first_name} ${e.last_name}`) }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${selectedEmp === e.id ? 'bg-accent font-medium' : ''}`}
                  >
                    {e.first_name} {e.last_name} <span className="text-muted-foreground">({e.employee_code})</span>
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Effective From</Label>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={!selectedShift || !selectedEmp || mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function ShiftsPage() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)

  const { data: shifts, isLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: fetchShiftsWithCounts,
  })

  const { data: deptAssignments } = useQuery({
    queryKey: ['dept-shifts'],
    queryFn: fetchDeptAssignments,
  })

  const { data: empOverrides } = useQuery({
    queryKey: ['emp-overrides'],
    queryFn: fetchEmployeeOverrides,
  })

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shifts').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Shift deactivated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: resetError } = await supabase
        .from('shifts')
        .update({ is_default: false })
        .eq('is_default', true)
        .neq('id', id)
      if (resetError) throw resetError
      const { error: setError } = await supabase
        .from('shifts')
        .update({ is_default: true })
        .eq('id', id)
      if (setError) throw setError
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Default shift updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeDeptAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('department_shifts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dept-shifts'] })
      qc.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Department assignment removed')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeOverride = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employee_shift_overrides').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emp-overrides'] })
      qc.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Override removed')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openEdit(shift: Shift) {
    setEditingShift(shift)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-8">
      {/* ── Shifts List ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Shifts</h1>
          <Button onClick={() => { setEditingShift(null); setDialogOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />Add Shift
          </Button>
        </div>

        <ShiftDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editingShift={editingShift}
        />

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !shifts || shifts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">No shifts defined yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shifts.map((shift) => (
              <Card key={shift.id} className={!shift.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      {shift.name}
                      {shift.is_default && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(shift)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      {shift.is_active && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deactivateMutation.mutate(shift.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Start:</span> {shift.start_time}</div>
                    <div><span className="text-muted-foreground">End:</span> {shift.end_time}</div>
                    {shift.saturday_start_time && (
                      <>
                        <div><span className="text-muted-foreground">Sat start:</span> {shift.saturday_start_time}</div>
                        <div><span className="text-muted-foreground">Sat end:</span> {shift.saturday_end_time}</div>
                      </>
                    )}
                    <div><span className="text-muted-foreground">Grace:</span> {shift.grace_period_minutes}min</div>
                    <div><span className="text-muted-foreground">Break:</span> {shift.break_minutes}min</div>
                    <div><span className="text-muted-foreground">Night:</span> {shift.is_night_shift ? 'Yes' : 'No'}</div>
                    <div><span className="text-muted-foreground">Late threshold:</span> {shift.late_mark_threshold}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {shift.weekly_off_days.map((d) => (
                      <Badge key={d} variant="outline" className="text-[10px]">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{shift.departmentCount} dept(s) · {shift.employeeOverrideCount} override(s)</span>
                    {!shift.is_default && shift.is_active && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setDefaultMutation.mutate(shift.id)}>
                        Set as default
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Department Assignments ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Department Assignments
          </h2>
          <DepartmentAssignmentDialog shifts={shifts ?? []} />
        </div>
        <Card>
          <CardContent className="p-0">
            {!deptAssignments || deptAssignments.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No departments assigned to shifts yet.</div>
            ) : (
              <div className="divide-y">
                {deptAssignments.map((da) => (
                  <div key={da.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <span className="font-medium">{da.department.name}</span>
                      <span className="text-muted-foreground"> → {da.shift.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">from {da.effective_from}</span>
                      {da.effective_to && <span className="text-xs text-muted-foreground"> to {da.effective_to}</span>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeDeptAssignment.mutate(da.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Employee Overrides ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-4 w-4" /> Employee Overrides
          </h2>
          <EmployeeOverrideDialog shifts={shifts ?? []} />
        </div>
        <Card>
          <CardContent className="p-0">
            {!empOverrides || empOverrides.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No employee overrides yet.</div>
            ) : (
              <div className="divide-y">
                {empOverrides.map((eo) => (
                  <div key={eo.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <span className="font-medium">{eo.employee.first_name} {eo.employee.last_name}</span>
                      <span className="text-muted-foreground"> ({eo.employee.employee_code})</span>
                      <span className="text-muted-foreground"> → {eo.shift.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">from {eo.effective_from}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeOverride.mutate(eo.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
