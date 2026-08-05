import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { getEffectiveTimes, resolveShift } from '../_shared/shift.ts'
import { computeTotalHours } from '../_shared/attendance.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr', 'employee'])

    const today = new Date().toISOString().slice(0, 10)
    const supabase = getServiceClient()

    const { data: record } = await supabase
      .from('attendance_records')
      .select('id, is_wfh, wfh_start_time, wfh_end_time, status')
      .eq('employee_id', actor.actorId)
      .eq('date', today)
      .maybeSingle()

    if (!record || !record.is_wfh || !record.wfh_start_time) {
      throw {
        code: 'NOT_FOUND',
        message: 'No active WFH session found for today.',
        status: 404,
      }
    }

    if (record.wfh_end_time) {
      throw {
        code: 'CONFLICT',
        message: 'WFH session already ended today.',
        status: 409,
      }
    }

    const now = new Date().toISOString()
    const shift = await resolveShift(actor.actorId, today)
    const effectiveEnd = getEffectiveTimes(shift, today).end_time

    const totalHours = computeTotalHours(
      record.wfh_start_time,
      now,
      shift.break_minutes,
      shift.is_night_shift,
      effectiveEnd
    )

    const { data: updated, error } = await supabase
      .from('attendance_records')
      .update({
        wfh_end_time: now,
        total_hours: totalHours,
        status: 'work_from_home',
      })
      .eq('id', record.id)
      .select('id, wfh_start_time, wfh_end_time, total_hours, status')
      .single()

    if (error) throw error

    return ok({
      attendance_record_id: updated.id,
      wfh_start_time: updated.wfh_start_time,
      wfh_end_time: updated.wfh_end_time,
      total_hours: updated.total_hours,
      status: updated.status,
    })
  } catch (e) {
    return handleError(e)
  }
})
