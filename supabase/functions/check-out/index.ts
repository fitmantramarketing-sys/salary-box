import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { resolveShift } from '../_shared/shift.ts'
import { checkDrift, checkGeofence } from '../_shared/geo.ts'
import { computeTotalHours } from '../_shared/attendance.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr', 'employee'])
    const { latitude, longitude, early_checkout_reason } = await req.json().catch(() => ({}))

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

    // Early checkout validation
    const [eh, em] = shift.end_time.split(':').map(Number)
    const checkOutDate = new Date(now)
    const shiftEndToday = new Date(now)
    shiftEndToday.setHours(eh, em, 0, 0)
    const isEarly = checkOutDate.getTime() < shiftEndToday.getTime()

    if (isEarly && !early_checkout_reason) {
      throw {
        code: 'VALIDATION_ERROR',
        message: 'Early checkout requires an early_checkout_reason.',
        status: 400,
      }
    }

    const totalHours = computeTotalHours(
      record.check_in_time,
      now,
      shift.break_minutes,
      shift.is_night_shift,
      shift.end_time
    )

    // Geofence enforcement — block checkout if outside any active geofence
    // (owner bypasses for flexibility)
    if (actor.actorRole !== 'owner' && latitude != null && longitude != null) {
      const geoCheck = await checkGeofence(Number(latitude), Number(longitude))
      if (!geoCheck.inside) {
        throw { code: 'FORBIDDEN', message: 'Check-out location is outside the allowed geofence area.', status: 403 }
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
      total_hours: totalHours,
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
