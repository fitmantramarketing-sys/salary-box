import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { getActor, assertRole } from '../_shared/auth.ts'
import { logAudit } from '../_shared/audit.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr'])

    const supabase = getServiceClient()
    const now = new Date()
    const currentYear = now.getFullYear()
    const nextYear = currentYear + 1

    const { data: leaveTypes } = await supabase
      .from('leave_types')
      .select('id')
      .eq('is_active', true)

    if (!leaveTypes || leaveTypes.length === 0) {
      return ok({ created: 0, year: nextYear })
    }

    const { data: employees } = await supabase
      .from('employees')
      .select('id')
      .eq('is_active', true)

    if (!employees || employees.length === 0) {
      return ok({ created: 0, year: nextYear })
    }

    let created = 0

    for (const emp of employees) {
      for (const lt of leaveTypes) {
        const { data: balance } = await supabase
          .from('leave_balances')
          .select('*')
          .eq('employee_id', emp.id)
          .eq('leave_type_id', lt.id)
          .eq('year', currentYear)
          .maybeSingle()

        if (!balance) continue

        const available = balance.opening_balance + balance.adjusted - balance.taken - balance.pending

        const { data: newBalance } = await supabase
          .from('leave_balances')
          .upsert({
            employee_id: emp.id,
            leave_type_id: lt.id,
            year: nextYear,
            opening_balance: Math.max(0, available),
            carry_forward_amount: 0,
            carry_forward_expiry: null,
            accrued: 0,
            taken: 0,
            pending: 0,
            adjusted: 0,
          }, {
            onConflict: 'employee_id, leave_type_id, year',
          })
          .select()
          .single()

        if (newBalance) {
          await logAudit({
            tableName: 'leave_balances',
            recordId: newBalance.id,
            action: 'INSERT',
            actorId: actor.actorId,
            actorRole: actor.actorRole,
            actorSystemFunction: 'year_end_reset',
            newData: newBalance,
          })
          created++
        }
      }
    }

    return ok({ created, year: nextYear })
  } catch (e) {
    return handleError(e)
  }
})
