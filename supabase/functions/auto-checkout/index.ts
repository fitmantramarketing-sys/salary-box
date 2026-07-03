import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { getEffectiveTimes, resolveShift } from '../_shared/shift.ts'
import { computeTotalHours } from '../_shared/attendance.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const supabase = getServiceClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: bufferConfig } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'auto_checkout_buffer_minutes')
      .maybeSingle()

    const bufferMinutes = parseInt(bufferConfig?.value || '30', 10)

    const { data: incomplete } = await supabase
      .from('attendance_records')
      .select('id, employee_id, check_in_time, shift_id, status, employees!attendance_records_employee_id_fkey(email)')
      .eq('date', today)
      .not('check_in_time', 'is', null)
      .is('check_out_time', null)

    if (!incomplete || incomplete.length === 0) {
      return ok({ processed: 0 })
    }

    let processed = 0
    for (const record of incomplete) {
      try {
        const shift = await resolveShift(record.employee_id, today)
        const effectiveEnd = getEffectiveTimes(shift, today).end_time
        const [eh, em] = effectiveEnd.split(':').map(Number)
        let totalMinutes = eh * 60 + em + bufferMinutes
        const autoH = Math.floor(totalMinutes / 60)
        const autoM = totalMinutes % 60
        const autoCheckoutStr = `${String(autoH).padStart(2, '0')}:${String(autoM).padStart(2, '0')}:00`
        const autoCheckoutIso = `${today}T${autoCheckoutStr}+05:30`

        const totalHours = record.check_in_time
          ? computeTotalHours(
              record.check_in_time,
              autoCheckoutIso,
              shift.break_minutes,
              shift.is_night_shift,
              effectiveEnd
            )
          : null

        const updates: Record<string, unknown> = {
          check_out_time: autoCheckoutIso,
          status: 'absent',
          total_hours: totalHours,
        }

        const { error: updateError } = await supabase
          .from('attendance_records')
          .update(updates)
          .eq('id', record.id)

        if (!updateError) {
          processed++
          const empEmail = (record.employees as unknown as { email: string }).email
          await createNotification({
            recipientId: record.employee_id,
            title: 'Incomplete Attendance',
            body: `Your attendance for ${today} was marked as absent due to incomplete check-out. Please submit a regularization request.`,
            type: 'attendance_incomplete',
            referenceId: record.id,
            referenceTable: 'attendance_records',
          })
          try {
            await sendEmail({
              to: empEmail,
              subject: 'Incomplete Attendance — Marked Absent',
              html: `
                <h2>Incomplete Attendance</h2>
                <p>Your attendance for <strong>${today}</strong> was auto-checked out as you did not check out on time.</p>
                <p>Your status has been marked as <strong>absent (incomplete attendance)</strong>. Please submit a regularization request if you were present.</p>
                <hr />
                <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
              `,
            })
          } catch (emailErr) {
            console.error(`Auto-checkout email failed for ${record.employee_id}:`, emailErr)
          }
        }
      } catch {
        continue
      }
    }

    return ok({ processed })
  } catch (e) {
    return handleError(e)
  }
})
