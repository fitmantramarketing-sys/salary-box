import { getActor, assertRole } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { ok, err, cors, handleError } from '../_shared/response.ts'

const EDITABLE_FIELDS = [
  'phone', 'personal_email', 'address_line1', 'address_line2', 'city', 'state',
  'pincode', 'emergency_contact_name', 'emergency_contact_phone', 'guardian_email', 'photo_url',
]

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr'])

    const body: { request_id: string; action: 'approve' | 'reject'; reviewer_notes?: string } = await req.json()
    const { request_id, action, reviewer_notes } = body

    if (!request_id || !action) {
      return err('VALIDATION_ERROR', 'request_id and action are required', 400)
    }

    const supabase = getServiceClient()

    const { data: request, error: fetchError } = await supabase
      .from('profile_edit_requests')
      .select('id, employee_id, requested_changes, status')
      .eq('id', request_id)
      .single()

    if (fetchError || !request) {
      return err('NOT_FOUND', 'Profile edit request not found', 404)
    }

    if (request.status !== 'pending') {
      return err('CONFLICT', 'Request has already been ' + request.status, 409)
    }

    if (action === 'approve') {
      const changes = request.requested_changes as Record<string, unknown>
      const validUpdates: Record<string, unknown> = {}

      for (const key of Object.keys(changes)) {
        if (EDITABLE_FIELDS.includes(key)) {
          validUpdates[key] = changes[key]
        }
      }

      if (Object.keys(validUpdates).length === 0) {
        return err('VALIDATION_ERROR', 'No valid fields to update', 400)
      }

      const { error: updateError } = await supabase
        .from('employees')
        .update(validUpdates)
        .eq('id', request.employee_id)

      if (updateError) {
        console.error('Employee update error:', updateError)
        return err('INTERNAL_ERROR', 'Failed to apply profile changes', 500)
      }
    }

    const { error: reviewError } = await supabase
      .from('profile_edit_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: actor.actorId,
        reviewer_notes: reviewer_notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request_id)

    if (reviewError) {
      console.error('Review update error:', reviewError)
      return err('INTERNAL_ERROR', 'Failed to update request status', 500)
    }

    return ok({ reviewed: true, request_id, status: action === 'approve' ? 'approved' : 'rejected' })
  } catch (e) {
    return handleError(e)
  }
})
