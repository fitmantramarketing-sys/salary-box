import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'
import { getEffectiveTimes, resolveShift } from '../_shared/shift.ts'
import { computeTotalHours } from '../_shared/attendance.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const supabase = getServiceClient()
    const today = new Date().toISOString().slice(0, 10)
    const processed = await closeOpenWfhSessions(supabase, today)
    const incomplete = await markIncomplete(supabase, today)

    return ok({ processed, incomplete })
  } catch (e) {
    return handleError(e)
  }
})

/** Auto-close WFH sessions that were never ended manually (shift end = end time). */
async function closeOpenWfhSessions(supabase: ReturnType<typeof getServiceClient>, today: string): Promise<number> {
  const { data: openWfh } = await supabase
    .from('attendance_records')
    .select('id, employee_id, wfh_start_time, employees!attendance_records_employee_id_fkey!inner(email, role)')
    .eq('date', today)
    .eq('is_wfh', true)
    .not('wfh_start_time', 'is', null)
    .is('wfh_end_time', null)
    .neq('employees.role', 'owner')
    .neq('is_manually_entered', true)

  if (!openWfh || openWfh.length === 0) return 0

  let processed = 0
  for (const record of openWfh) {
    try {
      const shift = await resolveShift(record.employee_id, today)
      const endTime = new Date().toISOString()
      const totalHours = computeTotalHours(
        record.wfh_start_time as string,
        endTime,
        shift.break_minutes,
        shift.is_night_shift,
        getEffectiveTimes(shift, today).end_time
      )
      const { error: updateError } = await supabase
        .from('attendance_records')
        .update({ wfh_end_time: endTime, total_hours: totalHours, status: 'work_from_home' })
        .eq('id', record.id)

      if (!updateError) {
        processed++
        const empEmail = (record.employees as unknown as { email: string }).email
        await createNotification({
          recipientId: record.employee_id,
          title: 'WFH Session Auto-Closed',
          body: `Your WFH session for ${today} was auto-closed at shift end (${totalHours}h).`,
          type: 'attendance_incomplete',
          referenceId: record.id,
          referenceTable: 'attendance_records',
        })
        try {
          await sendEmail({
            to: empEmail,
            subject: 'WFH Session Auto-Closed',
            html: `
              <h2>WFH Session Auto-Closed</h2>
              <p>Your WFH session for <strong>${today}</strong> was auto-closed at shift end.</p>
              <p>Total hours logged: <strong>${totalHours}h</strong>.</p>
              <hr />
              <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
            `,
          })
        } catch (emailErr) {
          console.error(`WFH auto-close email failed for ${record.employee_id}:`, emailErr)
        }
      }
    } catch {
      continue
    }
  }
  return processed
}

async function markIncomplete(supabase: ReturnType<typeof getServiceClient>, today: string): Promise<number> {
  const { data: incomplete } = await supabase
    .from('attendance_records')
    .select('id, employee_id, check_in_time, status, employees!attendance_records_employee_id_fkey!inner(email, role)')
    .eq('date', today)
    .not('check_in_time', 'is', null)
    .is('check_out_time', null)
    .neq('employees.role', 'owner')
    .neq('is_manually_entered', true)
    .neq('status', 'absent')

  if (!incomplete || incomplete.length === 0) {
    return 0
  }

  let processed = 0
  for (const record of incomplete) {
    try {
      const { error: updateError } = await supabase
        .from('attendance_records')
        .update({ status: 'incomplete' })
        .eq('id', record.id)

      if (!updateError) {
        processed++
        const empEmail = (record.employees as unknown as { email: string }).email
        await createNotification({
          recipientId: record.employee_id,
          title: 'Incomplete Attendance',
          body: `Your attendance for ${today} is incomplete due to a missing check-out. Please submit a regularization request.`,
          type: 'attendance_incomplete',
          referenceId: record.id,
          referenceTable: 'attendance_records',
        })
        try {
          await sendEmail({
            to: empEmail,
            subject: 'Incomplete Attendance',
            html: `
              <h2>Incomplete Attendance</h2>
              <p>You checked in today (<strong>${today}</strong>) but did not check out.</p>
              <p>Your status has been marked as <strong>incomplete</strong>. Please submit a regularization request to correct this.</p>
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

  return processed
}
