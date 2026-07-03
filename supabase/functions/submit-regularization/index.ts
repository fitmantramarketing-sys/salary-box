import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr', 'employee'])
    const body = await req.json()

    const { attendance_record_id, requested_status, requested_check_in, requested_check_out, reason } = body

    if (!attendance_record_id || !requested_status || !reason) {
      throw { code: 'VALIDATION_ERROR', message: 'attendance_record_id, requested_status, and reason are required.', status: 400 }
    }

    const now = new Date()
    if (requested_check_in && new Date(requested_check_in) > now) {
      throw { code: 'VALIDATION_ERROR', message: 'Requested check-in time cannot be in the future.', status: 400 }
    }
    if (requested_check_out && new Date(requested_check_out) > now) {
      throw { code: 'VALIDATION_ERROR', message: 'Requested check-out time cannot be in the future.', status: 400 }
    }

    const supabase = getServiceClient()

    const { data: record } = await supabase
      .from('attendance_records')
      .select('id, employee_id, date')
      .eq('id', attendance_record_id)
      .single()

    if (!record) {
      throw { code: 'NOT_FOUND', message: 'Attendance record not found.', status: 404 }
    }

    if (actor.actorRole === 'employee' && record.employee_id !== actor.actorId) {
      throw { code: 'FORBIDDEN', message: 'You can only request regularization for your own records.', status: 403 }
    }

    const { data: config } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'regularization_window_days')
      .maybeSingle()

    const windowDays = parseInt(config?.value || '7', 10)
    const recordDate = new Date(record.date + 'T00:00:00+05:30')
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - windowDays)
    cutoff.setHours(0, 0, 0, 0)

    if (recordDate < cutoff) {
      throw {
        code: 'VALIDATION_ERROR',
        message: `Regularization window is ${windowDays} days. This date is outside the allowed window.`,
        status: 400,
      }
    }

    // Check no pending request exists (DB unique index enforces it, but return clean error)
    const { data: pending } = await supabase
      .from('attendance_regularization_requests')
      .select('id')
      .eq('attendance_record_id', attendance_record_id)
      .eq('status', 'pending')
      .maybeSingle()

    if (pending) {
      throw { code: 'CONFLICT', message: 'A pending regularization request already exists for this record.', status: 409 }
    }

    const { data: request, error } = await supabase
      .from('attendance_regularization_requests')
      .insert({
        employee_id: record.employee_id,
        attendance_record_id: record.id,
        requested_status,
        requested_check_in: requested_check_in || null,
        requested_check_out: requested_check_out || null,
        reason,
        status: 'pending',
      })
      .select('id, status')
      .single()

    if (error) throw error

    // Notify all Owner and HR employees
    const { data: admins } = await supabase
      .from('employees')
      .select('id, email')
      .in('role', ['owner', 'hr'])
      .eq('is_active', true)

    if (admins) {
      for (const admin of admins) {
        await createNotification({
          recipientId: admin.id,
          title: 'Regularization Request',
          body: `Employee has requested regularization for ${record.date}. Reason: ${reason}`,
          type: 'regularization_pending',
          referenceId: request.id,
          referenceTable: 'attendance_regularization_requests',
        })
      }
      try {
        await sendEmail({
          to: admins.map((a) => a.email).join(','),
          subject: 'Regularization Request',
          html: `
            <h2>Regularization Request</h2>
            <p>An employee has requested regularization for <strong>${record.date}</strong>.</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>Please review the request in the HR portal.</p>
            <hr />
            <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
          `,
        })
      } catch (emailErr) {
        console.error('Regularization submission email failed:', emailErr)
      }
    }

    return ok({ request_id: request.id, status: request.status }, 201)
  } catch (e) {
    return handleError(e)
  }
})
