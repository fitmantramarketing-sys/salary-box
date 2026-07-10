import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { logAudit } from '../_shared/audit.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const supabase = getServiceClient()
    const now = new Date()
    const newYear = now.getFullYear().toString()
    const prevYear = (now.getFullYear() - 1).toString()

    const { data: leaveTypes } = await supabase
      .from('leave_types')
      .select('*')
      .eq('is_active', true)

    if (!leaveTypes) return ok({ processed: 0 })

    const { data: employees } = await supabase
      .from('employees')
      .select('id')
      .eq('is_active', true)

    if (!employees) return ok({ processed: 0 })

    let processed = 0

    for (const lt of leaveTypes) {
      for (const emp of employees) {
        const { data: prevBalance } = await supabase
          .from('leave_balances')
          .select('*')
          .eq('employee_id', emp.id)
          .eq('leave_type_id', lt.id)
          .eq('year', prevYear)
          .maybeSingle()

        const currentBalance = prevBalance
          ? (prevBalance.opening_balance + prevBalance.accrued + prevBalance.adjusted) - prevBalance.taken - prevBalance.pending
          : 0

        const carryForward = lt.max_carry_forward_days
          ? Math.min(currentBalance, lt.max_carry_forward_days)
          : currentBalance

        const expiryDays = lt.carry_forward_expiry_days ?? null
        let expiryDate = null
        if (expiryDays && carryForward > 0) {
          const exp = new Date(now.getFullYear(), 0, 1)
          exp.setDate(exp.getDate() + expiryDays)
          expiryDate = exp.toISOString().split('T')[0]
        }

        let openingBalance: number
        if (lt.accrual_type === 'manual') {
          // Manual types (PL): reset to annual_allocation (set by HR), no carry-forward
          openingBalance = prevBalance?.annual_allocation ?? 0
        } else if (lt.accrual_type === 'yearly') {
          openingBalance = carryForward + (lt.accrual_days ?? 0)
        } else {
          openingBalance = carryForward
        }

        const { data: existingNewBalance } = await supabase
          .from('leave_balances')
          .select('id')
          .eq('employee_id', emp.id)
          .eq('leave_type_id', lt.id)
          .eq('year', newYear)
          .maybeSingle()

        if (!existingNewBalance) {
          const { data: newBalance } = await supabase
            .from('leave_balances')
            .insert({
              employee_id: emp.id,
              leave_type_id: lt.id,
              year: newYear,
              opening_balance: openingBalance,
              annual_allocation: lt.accrual_type === 'manual' ? (prevBalance?.annual_allocation ?? 0) : 0,
              carry_forward_amount: carryForward > 0 ? carryForward : 0,
              carry_forward_expiry: expiryDate,
              accrued: lt.accrual_type === 'yearly' ? lt.accrual_days : 0,
              taken: 0,
              pending: 0,
              adjusted: 0,
            })
            .select()
            .single()

          if (newBalance) {
            await logAudit({
              tableName: 'leave_balances',
              recordId: newBalance.id,
              action: 'INSERT',
              actorSystemFunction: 'year_end_leave_rollover',
              newData: newBalance,
            })
            processed++
          }
        }
      }
    }

    return ok({ processed })
  } catch (e) {
    return handleError(e)
  }
})
