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

      // Check for existing attendance record
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', emp.id)
        .eq('date', today)
        .maybeSingle()

      // Skip non-working days (no record needed)
      if (holidayFlag || woffFlag) {
        // Clean up any existing records on non-working days (created by buggy EF versions)
        if (existing) {
          await supabase.from('attendance_records').delete().eq('id', existing.id)
          processed++
        }
        continue
      }

      if (existing) {
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

          const updatePayload: Record<string, unknown> = {
            total_hours: result.total_hours,
            is_late: result.is_late,
            is_geo_flagged: existing.is_geo_flagged,
          }

          // If a WFH record has a check-in, it's no longer WFH
          if (existing.is_wfh && existing.check_in_time) {
            updatePayload.is_wfh = false
          }

          // Three branches for status:
          //   1. Manually entered (regularization/manual entry) — respect human-set status
          //   2. Auto-checkout set absent (no manual checkout) — keep absent
          //   3. Normal auto-computed record — apply computed status
          if (!existing.is_manually_entered && existing.status !== 'absent') {
            updatePayload.status = result.status
          }

          await supabase
            .from('attendance_records')
            .update(updatePayload)
            .eq('id', existing.id)

          processed++
        }
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
