import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { RotateCcw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRole } from '@/hooks/useRole'
import { useEmployeeBalances, useUpdateLeaveBalance, useYearEndReset } from '@/features/leave-balances'

const currentYear = new Date().getFullYear()

export default function SettingsLeaveBalancesPage() {
  const { isOwner } = useRole()
  const { data, isLoading, isError, error } = useEmployeeBalances(currentYear)
  const updateMutation = useUpdateLeaveBalance()
  const resetMutation = useYearEndReset()

  const [editingCell, setEditingCell] = useState<{ balanceId: string; field: 'opening_balance' | 'adjusted' | 'annual_allocation' } | null>(null)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const employees = data?.employees ?? []
  const balances = data?.balances ?? []

  const leaveTypes = balances
    .map((b) => b.leave_type)
    .filter((lt, i, arr) => lt && arr.findIndex((x) => x?.id === lt.id) === i)
    .sort((a, b) => a!.name.localeCompare(b!.name))

  const balanceMap = new Map<string, typeof balances>()
  for (const b of balances) {
    const key = `${b.employee_id}-${b.leave_type_id}`
    if (!balanceMap.has(key)) balanceMap.set(key, [])
    balanceMap.get(key)!.push(b)
  }

  function getBalance(employeeId: string, leaveTypeId: string) {
    const key = `${employeeId}-${leaveTypeId}`
    return balanceMap.get(key)?.[0]
  }

  function startEdit(balanceId: string, field: 'opening_balance' | 'adjusted' | 'annual_allocation', currentValue: number) {
    setEditingCell({ balanceId, field })
    setEditValue(String(currentValue))
    requestAnimationFrame(() => editInputRef.current?.focus())
  }

  function cancelEdit() {
    setEditingCell(null)
    setEditValue('')
  }

  function saveEdit(balanceId: string, field: 'opening_balance' | 'adjusted' | 'annual_allocation') {
    const parsed = parseFloat(editValue)
    if (isNaN(parsed)) {
      cancelEdit()
      return
    }
    updateMutation.mutate({ id: balanceId, [field]: parsed })
    cancelEdit()
  }

  function handleKeyDown(e: React.KeyboardEvent, balanceId: string, field: 'opening_balance' | 'adjusted' | 'annual_allocation') {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit(balanceId, field)
    }
    if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Leave Balances</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            Failed to load leave balances: {(error as Error).message}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leave Balances &mdash; {currentYear}</h1>
        {isOwner && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={resetMutation.isPending}>
                {resetMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Year-End Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Year-End Reset</AlertDialogTitle>
                <AlertDialogDescription>
                  This will carry forward remaining balances for all employees into the next year and create new
                  balance records. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => resetMutation.mutate()}>
                  {resetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isLoading ? (
              <Skeleton className="h-5 w-48" />
            ) : (
              `Employee Balances (${employees.length} employees)`
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No active employees found.
            </p>
          ) : (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[200px]">
                      Employee
                    </TableHead>
                    <TableHead className="min-w-[90px]">Code</TableHead>
                    <TableHead className="min-w-[140px]">Department</TableHead>
                    {leaveTypes.map((lt) => (
                      <TableHead key={lt!.id} colSpan={4} className="text-center border-l">
                        {lt!.name}
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10" />
                    <TableHead />
                    <TableHead />
                    {leaveTypes.map((lt) => (
                      <>
                        <TableHead key={`${lt!.id}-annual`} className="text-xs font-normal text-muted-foreground min-w-[70px]">
                          Alloc
                        </TableHead>
                        <TableHead key={`${lt!.id}-opening`} className="text-xs font-normal text-muted-foreground min-w-[80px]">
                          Opening
                        </TableHead>
                        <TableHead key={`${lt!.id}-adjusted`} className="text-xs font-normal text-muted-foreground min-w-[80px]">
                          Adjusted
                        </TableHead>
                        <TableHead key={`${lt!.id}-total`} className="text-xs font-normal text-muted-foreground min-w-[70px]">
                          Total
                        </TableHead>
                      </>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => {
                    const deptName =
                      emp.department && typeof emp.department === 'object' && 'name' in emp.department
                        ? (emp.department as { name: string }).name
                        : '-'
                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="sticky left-0 bg-card z-10 font-medium">
                          {emp.first_name} {emp.last_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{emp.employee_code}</TableCell>
                        <TableCell className="text-muted-foreground">{deptName}</TableCell>
                        {leaveTypes.map((lt) => {
                          const bal = getBalance(emp.id, lt!.id)
                          const opening = bal?.opening_balance ?? 0
                          const adjusted = bal?.adjusted ?? 0
                          const total = opening + adjusted
                          const annualAlloc = bal?.annual_allocation ?? 0

                          const isEditingOpening =
                            editingCell?.balanceId === bal?.id && editingCell?.field === 'opening_balance'
                          const isEditingAdjusted =
                            editingCell?.balanceId === bal?.id && editingCell?.field === 'adjusted'

                          const isEditingAnnual =
                            editingCell?.balanceId === bal?.id && editingCell?.field === 'annual_allocation'

                          return (
                            <>
                              <TableCell key={`${lt!.id}-annual`}>
                                {bal ? (
                                  isEditingAnnual ? (
                                    <Input
                                      ref={editInputRef}
                                      className="h-7 w-20"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={() => saveEdit(bal.id, 'annual_allocation')}
                                      onKeyDown={(e) => handleKeyDown(e, bal.id, 'annual_allocation')}
                                      type="number"
                                      step="0.5"
                                    />
                                  ) : (
                                    <button
                                      className={cn(
                                        'h-7 px-2 rounded text-sm hover:bg-accent cursor-pointer text-left w-20',
                                        updateMutation.isPending && 'opacity-50 pointer-events-none'
                                      )}
                                      onClick={() => startEdit(bal.id, 'annual_allocation', annualAlloc)}
                                    >
                                      {annualAlloc}
                                    </button>
                                  )
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </TableCell>
                              <TableCell key={`${lt!.id}-opening`}>
                                {bal ? (
                                  isEditingOpening ? (
                                    <Input
                                      ref={editInputRef}
                                      className="h-7 w-20"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={() => saveEdit(bal.id, 'opening_balance')}
                                      onKeyDown={(e) => handleKeyDown(e, bal.id, 'opening_balance')}
                                      type="number"
                                      step="0.5"
                                    />
                                  ) : (
                                    <button
                                      className={cn(
                                        'h-7 px-2 rounded text-sm hover:bg-accent cursor-pointer text-left w-20',
                                        updateMutation.isPending && 'opacity-50 pointer-events-none'
                                      )}
                                      onClick={() => startEdit(bal.id, 'opening_balance', opening)}
                                    >
                                      {opening}
                                    </button>
                                  )
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </TableCell>
                              <TableCell key={`${lt!.id}-adjusted`}>
                                {bal ? (
                                  isEditingAdjusted ? (
                                    <Input
                                      ref={editInputRef}
                                      className="h-7 w-20"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={() => saveEdit(bal.id, 'adjusted')}
                                      onKeyDown={(e) => handleKeyDown(e, bal.id, 'adjusted')}
                                      type="number"
                                      step="0.5"
                                    />
                                  ) : (
                                    <button
                                      className={cn(
                                        'h-7 px-2 rounded text-sm hover:bg-accent cursor-pointer text-left w-20',
                                        updateMutation.isPending && 'opacity-50 pointer-events-none'
                                      )}
                                      onClick={() => startEdit(bal.id, 'adjusted', adjusted)}
                                    >
                                      {adjusted}
                                    </button>
                                  )
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </TableCell>
                              <TableCell key={`${lt!.id}-total`}>
                                <span className="text-sm font-medium">{total}</span>
                              </TableCell>
                            </>
                          )
                        })}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
