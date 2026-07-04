import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { resolveShift } from '../_shared/shift.ts'
import { isHoliday, isWeeklyOff } from '../_shared/holiday.ts'
import {
  computeStatus,
  type AttendanceRecordForCompute,
} from '../_shared/attendance.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const supabase = getServiceClient()

    const today = new Date().toISOString().slice(0, 10)

    // Fetch all active employees with email for notifications
    const { data: employees } = await supabase
      .from('employees')
      .select('id, email')
      .eq('is_active', true)
      .neq('role', 'owner')

    if (!employees || employees.length === 0) {
      return ok({ processed: 0 })
    }

    let processed = 0
    for (const emp of employees) {
      let shift
      try {
        shift = await resolveShift(emp.id, today)
      } catch {
        continue
      }

      const holidayFlag = await isHoliday(emp.id, today)
      const woffFlag = isWeeklyOff(shift, today)

      // Skip non-working days (no record needed)
      if (holidayFlag || woffFlag) continue

      // Check for existing attendance record
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', emp.id)
        .eq('date', today)
        .maybeSingle()

      if (existing) {
        // If already checked out, recompute status for consistency
        if (existing.check_out_time) {
          const rec: AttendanceRecordForCompute = {
            id: existing.id,
            employee_id: existing.employee_id,
            date: existing.date,
            shift_id: existing.shift_id,
            check_in_time: existing.check_in_time,
            check_out_time: existing.check_out_time,
            is_wfh: existing.is_wfh,
            status: existing.status,
            total_hours: existing.total_hours,
            is_late: existing.is_late,
            is_manually_entered: existing.is_manually_entered,
          }

          const result = computeStatus(rec, shift, holidayFlag, woffFlag)

          await supabase
            .from('attendance_records')
            .update({
              total_hours: result.total_hours,
              is_late: result.is_late,
              is_geo_flagged: existing.is_geo_flagged,
              status: result.status,
            })
            .eq('id', existing.id)

          processed++
        }
        // If checked in but no checkout — auto-checkout already set absent; keep it
      } else {
        // No record → create absent + notify
        const { error: insertError } = await supabase
          .from('attendance_records')
          .insert({
            employee_id: emp.id,
            date: today,
            shift_id: shift.id,
            status: 'absent',
            total_hours: null,
            is_late: false,
            is_wfh: false,
            is_manually_entered: false,
          })

        if (!insertError) {
          processed++
          await createNotification({
            recipientId: emp.id,
            title: 'Attendance Marked Absent',
            body: `Your attendance for ${today} was marked as absent as you did not check in. Please submit a regularization request if you were present.`,
            type: 'attendance_incomplete',
          })
          try {
            await sendEmail({
              to: emp.email,
              subject: 'Attendance Marked Absent',
              html: `
                <h2>Attendance Marked Absent</h2>
                <p>You did not check in today (<strong>${today}</strong>).</p>
                <p>Your attendance has been marked as <strong>absent</strong>. Please submit a regularization request in the HR portal if you were present.</p>
                <hr />
                <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
              `,
            })
          } catch (emailErr) {
            console.error(`Absent notification email failed for ${emp.id}:`, emailErr)
          }
        }
      }
    }

    return ok({ processed })
  } catch (e) {
    return handleError(e)
  }
})
