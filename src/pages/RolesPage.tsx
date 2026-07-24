import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import type { Role } from '@/types'

type EmployeeRow = {
  id: string
  first_name: string
  last_name: string
  employee_code: string
  role: Role
  department: { name: string } | null
}

const ROLES: Role[] = ['owner', 'hr', 'employee', 'system_admin']

export default function RolesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Role>>({})

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('id, first_name, last_name, employee_code, role, department:departments!department_id(name)')
          .order('first_name')
        if (!cancelled && !error) setEmployees(data ?? [])
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [])

  function handleChange(employeeId: string, role: Role) {
    setEdits((prev) => ({ ...prev, [employeeId]: role }))
  }

  async function handleSave(employeeId: string) {
    const newRole = edits[employeeId]
    if (!newRole) return
    setSaving(employeeId)
    try {
      const { error } = await supabase
        .from('employees')
        .update({ role: newRole })
        .eq('id', employeeId)
      if (error) throw error
      toast.success('Role updated')
      setEmployees((prev) => prev.map((e) => e.id === employeeId ? { ...e, role: newRole } : e))
      setEdits((prev) => { const rest = { ...prev }; delete rest[employeeId]; return rest })
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? 'Failed to update role')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Role Management</h1>
        <Card><CardContent className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Role Management</h1>
      <p className="text-sm text-muted-foreground">Change employee roles. Changes take effect on the employee's next request.</p>

      <Card>
        <CardHeader><CardTitle>Team Members</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Team Member</th>
                  <th className="text-left p-3 font-medium">Code</th>
                  <th className="text-left p-3 font-medium">Department</th>
                  <th className="text-left p-3 font-medium">Current Role</th>
                  <th className="text-left p-3 font-medium">New Role</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const isEdited = emp.id in edits
                  return (
                    <tr key={emp.id} className="border-b hover:bg-accent/30">
                      <td className="p-3 font-medium">{emp.first_name} {emp.last_name}</td>
                      <td className="p-3 font-mono text-xs">{emp.employee_code}</td>
                      <td className="p-3 text-muted-foreground">{emp.department?.name ?? '—'}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          emp.role === 'owner' ? 'text-purple-700 bg-purple-50' :
                          emp.role === 'hr' ? 'text-blue-700 bg-blue-50' :
                          emp.role === 'system_admin' ? 'text-orange-700 bg-orange-50' :
                          'text-green-700 bg-green-50'
                        }`}>
                          {emp.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3">
                        <Select
                          value={edits[emp.id] ?? emp.role}
                          onValueChange={(v) => handleChange(emp.id, v as Role)}
                        >
                          <SelectTrigger className="w-32 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!isEdited || saving === emp.id}
                          onClick={() => handleSave(emp.id)}
                        >
                          {saving === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
