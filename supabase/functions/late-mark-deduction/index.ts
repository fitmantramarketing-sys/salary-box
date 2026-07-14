import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const supabase = getServiceClient()
    const now = new Date()

    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const monthStart = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const { data: employees } = await supabase
      .from('employees')
      .select('id, email')
      .eq('is_active', true)
      .neq('role', 'owner')

    if (!employees || employees.length === 0) {
      return ok({ processed: 0 })
    }

    // Get leave type IDs for priority deduction order
    const { data: leaveTypes } = await supabase
      .from('leave_types')
      .select('id, code')
      .in('code', ['CL', 'EL', 'LWP'])

    if (!leaveTypes || leaveTypes.length === 0) {
      return ok({ processed: 0, message: 'No CL/EL/LWP leave types configured.' })
    }

    const clType = leaveTypes.find((lt) => lt.code === 'CL')
    const elType = leaveTypes.find((lt) => lt.code === 'EL')
    const lwpType = leaveTypes.find((lt) => lt.code === 'LWP')
    const deductionPriority = [clType, elType, lwpType].filter(Boolean)

    const currentYear = now.getFullYear()
    let processed = 0

    for (const emp of employees) {
        const { data: lateRecord } = await supabase
          .from('attendance_records')
          .select('is_late, shift_id')
          .eq('employee_id', emp.id)
          .eq('is_late', true)
          .neq('is_manually_entered', true)
          .gte('date', monthStart)
          .lt('date', monthEnd)

      if (!lateRecord || lateRecord.length === 0) continue

      // Get employee's shift threshold
      let threshold = 3

      // Try to resolve shift for the employee - use a recent date to get the shift
      const { data: recentRecord } = await supabase
        .from('attendance_records')
        .select('shift_id')
        .eq('employee_id', emp.id)
        .not('shift_id', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recentRecord?.shift_id) {
        const { data: shift } = await supabase
          .from('shifts')
          .select('late_mark_threshold')
          .eq('id', recentRecord.shift_id)
          .single()

        if (shift) threshold = shift.late_mark_threshold
      } else {
        const { data: defaultShift } = await supabase
          .from('shifts')
          .select('late_mark_threshold')
          .eq('is_default', true)
          .maybeSingle()

        if (defaultShift) threshold = defaultShift.late_mark_threshold
      }

      if (lateRecord.length < threshold) continue

      // Deduct 0.5 from leave balance — CL first, then EL, then LWP
      let deducted = false
      for (const lt of deductionPriority) {
        if (!lt) continue
        const { data: balance } = await supabase
          .from('leave_balances')
          .select('id, opening_balance, accrued, taken, pending, adjusted')
          .eq('employee_id', emp.id)
          .eq('leave_type_id', lt.id)
          .eq('year', currentYear)
          .maybeSingle()

        if (!balance) continue

        const available = balance.opening_balance + balance.accrued + balance.adjusted - balance.taken - balance.pending
        if (available <= 0) continue

        const deduction = Math.min(0.5, available)

        const { error } = await supabase
          .from('leave_balances')
          .update({
            adjusted: (balance.adjusted || 0) - deduction,
          })
          .eq('id', balance.id)

        if (!error) {
          await createNotification({
            recipientId: emp.id,
            title: 'Late Mark Deduction',
            body: `0.5 day deducted from your ${lt.code} balance due to ${lateRecord.length} late marks this month.`,
            type: 'late_mark_deduction',
          })
          try {
            await sendEmail({
              to: emp.email,
              subject: 'Late Mark Deduction Applied',
              html: `
                <h2>Late Mark Deduction</h2>
                <p>You had <strong>${lateRecord.length} late marks</strong> last month.</p>
                <p><strong>0.5 day</strong> has been deducted from your <strong>${lt.code}</strong> balance.</p>
                <hr />
                <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
              `,
            })
          } catch (emailErr) {
            console.error(`Late deduction email failed for ${emp.id}:`, emailErr)
          }
          deducted = true
          processed++
          break
        }
      }
      if (!deducted) {
        await createNotification({
          recipientId: emp.id,
          title: 'Late Mark Warning',
          body: `You had ${lateRecord.length} late marks last month but no leave balance available for deduction.`,
          type: 'late_mark_warning',
        })
      }
    }

    return ok({ processed })
  } catch (e) {
    return handleError(e)
  }
})
