import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { resolveShift } from '../_shared/shift.ts'
import { isHoliday, isWeeklyOff } from '../_shared/holiday.ts'
import { computeStatus, type AttendanceRecordForCompute } from '../_shared/attendance.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr', 'employee'])

    const today = new Date().toISOString().slice(0, 10)
    const supabase = getServiceClient()

    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id, status, check_in_time')
      .eq('employee_id', actor.actorId)
      .eq('date', today)
      .maybeSingle()

    if (existing?.status === 'on_leave') {
      throw {
        code: 'CONFLICT',
        message: 'Cannot log WFH on an approved leave day.',
        status: 409,
      }
    }

    const shift = await resolveShift(actor.actorId, today)
    const holidayFlag = await isHoliday(actor.actorId, today)
    const woffFlag = isWeeklyOff(shift, today)

    const rec: AttendanceRecordForCompute = {
      employee_id: actor.actorId,
      date: today,
      check_in_time: existing?.check_in_time || null,
      check_out_time: null,
      is_wfh: true,
      status: existing?.status || '',
      total_hours: null,
      is_late: false,
      is_manually_entered: false,
    }

    const { status, is_late, total_hours } = computeStatus(rec, shift, holidayFlag, woffFlag)

    const { data: record, error } = await supabase
      .from('attendance_records')
      .upsert(
        {
          employee_id: actor.actorId,
          date: today,
          is_wfh: true,
          status,
          is_late,
          total_hours,
        },
        { onConflict: 'employee_id, date', ignoreDuplicates: false }
      )
      .select('id, is_wfh, status')
      .single()

    if (error) throw error

    return ok({
      attendance_record_id: record.id,
      is_wfh: record.is_wfh,
      status: record.status,
    })
  } catch (e) {
    return handleError(e)
  }
})
