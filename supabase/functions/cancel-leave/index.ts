import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError, err } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr', 'employee'])

    const { application_id, reason } = await req.json()

    if (!application_id) {
      return err('VALIDATION_ERROR', 'application_id is required')
    }

    const supabase = getServiceClient()

    const { data: app, error: appErr } = await supabase
      .from('leave_applications')
      .select('*')
      .eq('id', application_id)
      .single()

    if (appErr || !app) {
      return err('NOT_FOUND', 'Leave application not found')
    }

    if (app.employee_id !== actor.actorId && actor.actorRole === 'employee') {
      return err('FORBIDDEN', 'You can only cancel your own leave applications')
    }

    if (app.status === 'approved') {
      return err('CONFLICT', 'This leave is already approved. Use request-leave-cancellation instead.')
    }

    if (app.status !== 'pending') {
      return err('CONFLICT', `Cannot cancel a leave with status "${app.status}"`)
    }

    await supabase
      .from('leave_applications')
      .update({
        status: 'cancelled',
        cancelled_by: actor.actorId,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason ?? null,
      })
      .eq('id', application_id)

    const paidDays = app.working_days_count - (app.lwp_days ?? 0)

    const { data: balance } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', app.employee_id)
      .eq('leave_type_id', app.leave_type_id)
      .eq('year', app.from_date.substring(0, 4))
      .single()

    if (balance && paidDays > 0) {
      await supabase
        .from('leave_balances')
        .update({ pending: Math.max(0, balance.pending - paidDays) })
        .eq('id', balance.id)
    }

    return ok({ application_id, status: 'cancelled' })
  } catch (e) {
    return handleError(e)
  }
})
