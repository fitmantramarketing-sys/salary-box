import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { getEffectiveTimes, resolveShift } from '../_shared/shift.ts'
import { checkDrift, checkGeofence } from '../_shared/geo.ts'
import { checkIpWhitelist } from '../_shared/ip.ts'
import { computeStatus, getISTMinutes, type AttendanceRecordForCompute } from '../_shared/attendance.ts'
import { isHoliday, isWeeklyOff } from '../_shared/holiday.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr', 'employee'])
    const { latitude, longitude, early_checkout_reason } = await req.json().catch(() => ({}))

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''

    const today = new Date().toISOString().slice(0, 10)
    const supabase = getServiceClient()

    const { data: record, error: findError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', actor.actorId)
      .eq('date', today)
      .maybeSingle()

    if (findError || !record) {
      throw { code: 'NOT_FOUND', message: 'No check-in record found for today.', status: 404 }
    }

    if (record.check_out_time) {
      throw { code: 'CONFLICT', message: 'Already checked out today.', status: 409 }
    }

    const now = new Date().toISOString()
    const shift = await resolveShift(actor.actorId, today)

    // Early checkout validation — compare IST minutes
    const effectiveEnd = getEffectiveTimes(shift, today).end_time
    const [eh, em] = effectiveEnd.split(':').map(Number)
    const checkoutMinutes = getISTMinutes(now)
    const endMinutes = eh * 60 + em
    const isEarly = checkoutMinutes < endMinutes

    if (isEarly && !early_checkout_reason) {
      throw {
        code: 'VALIDATION_ERROR',
        message: 'Early checkout requires an early_checkout_reason.',
        status: 400,
      }
    }

    // Re-compute status with check-out data for real-time accuracy
    const holidayFlag = await isHoliday(actor.actorId, today)
    const woffFlag = isWeeklyOff(shift, today)

    const statusResult = computeStatus(
      {
        employee_id: record.employee_id,
        date: today,
        check_in_time: record.check_in_time,
        check_out_time: now,
        is_wfh: record.is_wfh,
        status: record.status,
        is_late: record.is_late,
        is_manually_entered: record.is_manually_entered,
      } as AttendanceRecordForCompute,
      shift,
      holidayFlag,
      woffFlag
    )

    // Geolocation & geofence enforcement
    // Owner bypasses entirely for flexibility
    if (actor.actorRole !== 'owner') {
      if (latitude == null || longitude == null) {
        const ipCheck = await checkIpWhitelist(clientIp)
        if (!ipCheck.allowed) {
          throw { code: 'LOCATION_REQUIRED', message: 'Location access is required for check-out. Please enable GPS.', status: 403 }
        }
      } else {
        const geoCheck = await checkGeofence(Number(latitude), Number(longitude))
        if (!geoCheck.inside) {
          throw { code: 'FORBIDDEN', message: 'Check-out location is outside the allowed geofence area.', status: 403 }
        }
      }
    }

    let isGeoFlagged = record.is_geo_flagged
    if (
      latitude != null &&
      longitude != null &&
      record.check_in_lat != null &&
      record.check_in_lng != null
    ) {
      const drifted = checkDrift(
        Number(record.check_in_lat),
        Number(record.check_in_lng),
        Number(latitude),
        Number(longitude)
      )
      if (drifted) isGeoFlagged = true
    }

    const updates: Record<string, unknown> = {
      check_out_time: now,
      total_hours: statusResult.total_hours,
      status: statusResult.status,
      is_late: statusResult.is_late,
      is_geo_flagged: isGeoFlagged,
    }
    if (isEarly) {
      updates.early_checkout_reason = early_checkout_reason
      updates.early_checkout_status = 'pending'
    }
    if (latitude != null) updates.check_out_lat = Number(latitude)
    if (longitude != null) updates.check_out_lng = Number(longitude)

    const { data: updated, error: updateError } = await supabase
      .from('attendance_records')
      .update(updates)
      .eq('id', record.id)
      .select('id, check_out_time, total_hours, is_geo_flagged')
      .single()

    if (updateError) throw updateError

    return ok({
      attendance_record_id: updated.id,
      check_out_time: updated.check_out_time,
      total_hours: updated.total_hours,
      is_geo_flagged: updated.is_geo_flagged,
    })
  } catch (e) {
    return handleError(e)
  }
})
