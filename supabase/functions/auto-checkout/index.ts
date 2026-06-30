import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { resolveShift } from '../_shared/shift.ts'
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
      .select('id, employee_id, check_in_time, shift_id, employees!attendance_records_employee_id_fkey(email)')
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
        const [eh, em] = shift.end_time.split(':').map(Number)
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
              shift.end_time
            )
          : null

        const { error: updateError } = await supabase
          .from('attendance_records')
          .update({
            check_out_time: autoCheckoutIso,
            status: 'half_day',
            total_hours: totalHours,
          })
          .eq('id', record.id)

        if (!updateError) {
          processed++
          const empEmail = (record.employees as unknown as { email: string }).email
          await createNotification({
            recipientId: record.employee_id,
            title: 'Attendance Auto-Checked Out',
            body: `Your attendance for ${today} was auto-checked out as half-day. Please submit a regularization request if you were present for the full day.`,
            type: 'attendance_incomplete',
            referenceId: record.id,
            referenceTable: 'attendance_records',
          })
          try {
            await sendEmail({
              to: empEmail,
              subject: 'Attendance Auto-Checked Out',
              html: `
                <h2>Attendance Auto-Checked Out</h2>
                <p>Your attendance for <strong>${today}</strong> was auto-checked out as you did not check out on time.</p>
                <p>Your status has been marked as <strong>half-day</strong>. Please submit a regularization request if you were present for the full day.</p>
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
