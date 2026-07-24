import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getAvailableBalance } from '../utils'
import type { Employee, LeaveType, LeaveBalance } from '@/types'

export function LeaveBalanceReport() {
  const year = new Date().getFullYear()
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_code'>[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [balances, setBalances] = useState<(LeaveBalance & { leave_type: LeaveType })[]>([])

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      setLoading(true)
      try {
        const [empRes, ltRes, balRes] = await Promise.all([
          supabase
            .from('employees')
            .select('id, first_name, last_name, employee_code')
            .eq('is_active', true)
            .order('first_name'),
          supabase
            .from('leave_types')
            .select('*')
            .eq('is_active', true)
            .order('name'),
          supabase
            .from('leave_balances')
            .select('*, leave_type:leave_types(*)')
            .eq('year', year),
        ])
        if (cancelled) return
        setEmployees(empRes.data ?? [])
        setLeaveTypes(ltRes.data ?? [])
        setBalances(balRes.data ?? [])
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [year])

  const balanceMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const b of balances) {
      if (!map.has(b.employee_id)) map.set(b.employee_id, new Map())
      map.get(b.employee_id)!.set(b.leave_type_id, getAvailableBalance(b))
    }
    return map
  }, [balances])

  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const lt of leaveTypes) t[lt.id] = 0
    for (const [, typeMap] of balanceMap) {
      for (const [ltId, avail] of typeMap) {
        t[ltId] = (t[ltId] ?? 0) + avail
      }
    }
    return t
  }, [leaveTypes, balanceMap])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leave Balance Report — {year}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (employees.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No active employees found
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leave Balance Report — {year}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10">Team Member</TableHead>
                <TableHead className="sticky left-[180px] bg-background z-10">Code</TableHead>
                {leaveTypes.map((lt) => (
                  <TableHead key={lt.id} className="text-center min-w-[80px]">{lt.code}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => {
                const empBalances = balanceMap.get(emp.id)
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="sticky left-0 bg-background font-medium whitespace-nowrap">
                      {emp.first_name} {emp.last_name}
                    </TableCell>
                    <TableCell className="sticky left-[180px] bg-background font-mono text-xs">
                      {emp.employee_code}
                    </TableCell>
                    {leaveTypes.map((lt) => {
                      const avail = empBalances?.get(lt.id) ?? 0
                      return (
                        <TableCell key={lt.id} className="text-center">
                          {avail}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
              <TableRow className="font-semibold bg-muted/50">
                <TableCell className="sticky left-0 bg-muted/50">Total</TableCell>
                <TableCell className="sticky left-[180px] bg-muted/50">—</TableCell>
                {leaveTypes.map((lt) => (
                  <TableCell key={lt.id} className="text-center">
                    {totals[lt.id] ?? 0}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
