import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { resolveShift } from '../_shared/shift.ts'
import {
  computeStatus,
  computeTotalHours,
  type AttendanceRecordForCompute,
} from '../_shared/attendance.ts'
import { getEffectiveTimes } from '../_shared/shift.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr'])
    const body = await req.json()

    const { employee_id, date, check_in_time, check_out_time, is_wfh, reason, manual_status } = body

    if (!employee_id || !date || !reason) {
      throw {
        code: 'VALIDATION_ERROR',
        message: 'employee_id, date, and reason are required.',
        status: 400,
      }
    }

    if (manual_status && !['present', 'half_day', 'absent'].includes(manual_status)) {
      throw {
        code: 'VALIDATION_ERROR',
        message: 'manual_status must be one of: present, half_day, absent.',
        status: 400,
      }
    }

    const now = new Date()
    if (check_in_time && new Date(check_in_time) > now) {
      throw { code: 'VALIDATION_ERROR', message: 'Check-in time cannot be in the future.', status: 400 }
    }
    if (check_out_time && new Date(check_out_time) > now) {
      throw { code: 'VALIDATION_ERROR', message: 'Check-out time cannot be in the future.', status: 400 }
    }

    const supabase = getServiceClient()
    const shift = await resolveShift(employee_id, date)

    const payload: Record<string, unknown> = {
      employee_id,
      date,
      shift_id: shift.id,
      is_manually_entered: true,
      manual_entry_reason: reason,
      manual_entry_by: actor.actorId,
    }

    if (manual_status) {
      // Explicit status — bypass computeStatus for status
      payload.status = manual_status
      payload.is_wfh = false
      payload.is_late = false

      if (check_in_time) payload.check_in_time = check_in_time
      if (check_out_time) payload.check_out_time = check_out_time

      // Compute total_hours from times if both provided, else null
      if (check_in_time && check_out_time) {
        const effective = getEffectiveTimes(shift, date)
        payload.total_hours = computeTotalHours(
          check_in_time,
          check_out_time,
          shift.break_minutes,
          shift.is_night_shift,
          effective.end_time
        )
      } else {
        payload.total_hours = null
      }
    } else {
      // Legacy path — compute status from times / is_wfh
      const rec: AttendanceRecordForCompute = {
        employee_id,
        date,
        check_in_time: check_in_time || null,
        check_out_time: check_out_time || null,
        is_wfh: is_wfh || false,
        status: 'absent',
        total_hours: null,
        is_late: false,
        is_manually_entered: true,
      }

      const result = computeStatus(rec, shift, false, false)

      if (check_in_time) {
        payload.check_in_time = check_in_time
        payload.is_wfh = false
      }
      if (check_out_time) payload.check_out_time = check_out_time
      if (is_wfh && !check_in_time) payload.is_wfh = true
      payload.status = result.status
      payload.total_hours = result.total_hours
      payload.is_late = result.is_late
    }

    const { data: record, error } = await supabase
      .from('attendance_records')
      .upsert(payload, { onConflict: 'employee_id, date', ignoreDuplicates: false })
      .select('id, status, total_hours')
      .single()

    if (error) throw error

    return ok({
      attendance_record_id: record.id,
      status: record.status,
      total_hours: record.total_hours,
    })
  } catch (e) {
    return handleError(e)
  }
})
