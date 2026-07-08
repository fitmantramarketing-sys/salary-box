import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr', 'employee'])
    const { request_id } = await req.json()

    if (!request_id) {
      throw { code: 'VALIDATION_ERROR', message: 'request_id is required.', status: 400 }
    }

    const supabase = getServiceClient()

    const { data: existing } = await supabase
      .from('attendance_regularization_requests')
      .select('id, employee_id, status')
      .eq('id', request_id)
      .single()

    if (!existing) {
      throw { code: 'NOT_FOUND', message: 'Regularization request not found.', status: 404 }
    }

    if (existing.status !== 'pending') {
      throw { code: 'CONFLICT', message: 'Only pending requests can be withdrawn.', status: 409 }
    }

    // Employees can only withdraw their own requests
    if (actor.actorRole === 'employee' && existing.employee_id !== actor.actorId) {
      throw { code: 'FORBIDDEN', message: 'You can only withdraw your own requests.', status: 403 }
    }

    const { error } = await supabase
      .from('attendance_regularization_requests')
      .update({ status: 'withdrawn' })
      .eq('id', request_id)

    if (error) throw error

    return ok({ request_id, status: 'withdrawn' })
  } catch (e) {
    return handleError(e)
  }
})
