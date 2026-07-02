import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { resolveShift } from '../_shared/shift.ts'
import { checkIpWhitelist } from '../_shared/ip.ts'
import { checkGeofence } from '../_shared/geo.ts'
import { computeIsLate, computeStatus, type AttendanceRecordForCompute } from '../_shared/attendance.ts'
import { isHoliday, isWeeklyOff } from '../_shared/holiday.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr', 'employee'])
    const { latitude, longitude } = await req.json().catch(() => ({}))

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''

    const ipCheck = await checkIpWhitelist(clientIp)
    if (!ipCheck.allowed) {
      throw { code: 'FORBIDDEN', message: ipCheck.message, status: 403 }
    }

    const today = new Date().toISOString().slice(0, 10)
    const supabase = getServiceClient()
    const shift = await resolveShift(actor.actorId, today)

    // Geofence enforcement — hard block if outside any active geofence
    // Owner bypasses for flexibility
    if (actor.actorRole !== 'owner') {
      if (latitude == null || longitude == null) {
        throw { code: 'LOCATION_REQUIRED', message: 'Location access is required for check-in. Please enable GPS.', status: 403 }
      }
      const geoCheck = await checkGeofence(Number(latitude), Number(longitude))
      if (!geoCheck.inside) {
        throw { code: 'FORBIDDEN', message: 'Check-in location is outside the allowed geofence area.', status: 403 }
      }
    }

    let isGeoFlagged = false

    const now = new Date().toISOString()

    // Late if check-in > shift start (no grace)
    const isLate = computeIsLate(now, shift.start_time, 0)

    // Compute status using shared function — handles all branches
    const holidayFlag = await isHoliday(actor.actorId, today)
    const woffFlag = isWeeklyOff(shift, today)

    const statusResult = computeStatus(
      {
        employee_id: actor.actorId,
        date: today,
        check_in_time: now,
        check_out_time: null,
        is_wfh: false,
        status: 'absent',        // placeholder, computeStatus overrides
        is_late: isLate,
        is_manually_entered: false,
      } as AttendanceRecordForCompute,
      shift,
      holidayFlag,
      woffFlag
    )

    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id, check_in_time')
      .eq('employee_id', actor.actorId)
      .eq('date', today)
      .maybeSingle()

    if (existing?.check_in_time) {
      throw { code: 'CONFLICT', message: 'Already checked in today.', status: 409 }
    }

    // Get late count this month for frontend warning
    const monthStart = today.slice(0, 7) + '-01'
    const { count: lateCount } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', actor.actorId)
      .eq('is_late', true)
      .gte('date', monthStart)
      .lt('date', today)

    const payload: Record<string, unknown> = {
      employee_id: actor.actorId,
      date: today,
      shift_id: shift.id,
      check_in_time: now,
      check_in_ip: clientIp || null,
      is_late: statusResult.is_late,
      is_geo_flagged: isGeoFlagged,
      status: statusResult.status,
    }
    if (latitude != null) payload.check_in_lat = Number(latitude)
    if (longitude != null) payload.check_in_lng = Number(longitude)

    const { data: record, error } = await supabase
      .from('attendance_records')
      .upsert(payload, { onConflict: 'employee_id, date', ignoreDuplicates: false })
      .select('id, check_in_time, is_late, is_geo_flagged, status')
      .single()

    if (error) throw error

    return ok({
      attendance_record_id: record.id,
      check_in_time: record.check_in_time,
      is_late: record.is_late,
      is_geo_flagged: record.is_geo_flagged,
      status: record.status,
      late_count_this_month: (lateCount ?? 0) + (isLate ? 1 : 0),
      late_threshold: shift.late_mark_threshold,
    })
  } catch (e) {
    return handleError(e)
  }
})
