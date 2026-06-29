import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError, err } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'

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
      return err('FORBIDDEN', 'You can only request cancellation of your own leave')
    }

    if (app.status !== 'approved') {
      return err('CONFLICT', 'Only approved leaves can request cancellation')
    }

    if (app.from_date <= new Date().toISOString().split('T')[0]) {
      return err('CONFLICT', 'Past or current leaves cannot be cancelled')
    }

    await supabase
      .from('leave_applications')
      .update({
        cancellation_requested: true,
        cancellation_requested_at: new Date().toISOString(),
        cancellation_reason: reason ?? null,
      })
      .eq('id', application_id)

    const { data: admins } = await supabase
      .from('employees')
      .select('id, email')
      .in('role', ['owner', 'hr'])
      .eq('is_active', true)

    for (const admin of admins ?? []) {
      await createNotification({
        recipientId: admin.id,
        title: 'Leave Cancellation Requested',
        body: `Employee has requested cancellation of their approved leave (${reason ?? ''})`,
        type: 'cancellation_requested',
        referenceId: application_id,
        referenceTable: 'leave_applications',
      })
    }

    try {
      const adminEmails = (admins ?? []).map((a) => a.email).filter(Boolean).join(',')
      if (adminEmails) {
        await sendEmail({
          to: adminEmails,
          subject: 'Leave Cancellation Requested',
          html: `
            <h2>Leave Cancellation Requested</h2>
            <p>An employee has requested cancellation of their approved leave.</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            <p>Please review the request in the HR portal.</p>
            <hr />
            <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
          `,
        })
      }
    } catch (emailErr) {
      console.error('Cancellation request email failed:', emailErr)
    }

    return ok({ application_id, cancellation_requested: true })
  } catch (e) {
    return handleError(e)
  }
})
