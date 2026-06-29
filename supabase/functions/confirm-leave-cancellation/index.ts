import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError, err } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr'])

    const { application_id, action, comment } = await req.json()

    if (!application_id || !['confirm', 'reject'].includes(action)) {
      return err('VALIDATION_ERROR', 'application_id and action (confirm|reject) are required')
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

    const { data: employee } = await supabase
      .from('employees')
      .select('email')
      .eq('id', app.employee_id)
      .single()

    if (!app.cancellation_requested) {
      return err('NOT_FOUND', 'No pending cancellation request for this application')
    }

    if (action === 'confirm') {
      const today = new Date().toISOString().split('T')[0]

      await supabase
        .from('leave_applications')
        .update({
          status: 'cancelled',
          cancellation_requested: false,
          cancelled_by: actor.actorId,
          cancelled_at: new Date().toISOString(),
          reviewer_comment: comment ?? null,
        })
        .eq('id', application_id)

      if (app.to_date >= today) {
        const { data: balance } = await supabase
          .from('leave_balances')
          .select('*')
          .eq('employee_id', app.employee_id)
          .eq('leave_type_id', app.leave_type_id)
          .eq('year', app.from_date.substring(0, 4))
          .single()

        if (balance) {
          await supabase
            .from('leave_balances')
            .update({ taken: Math.max(0, balance.taken - app.working_days_count) })
            .eq('id', balance.id)
        }
      }

      const { data: records } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('employee_id', app.employee_id)
        .gte('date', app.from_date)
        .lte('date', app.to_date)
        .eq('status', 'on_leave')

      for (const rec of records ?? []) {
        await supabase
          .from('attendance_records')
          .delete()
          .eq('id', rec.id)
      }

      await createNotification({
        recipientId: app.employee_id,
        title: 'Leave Cancellation Confirmed',
        body: `Your leave cancellation request has been confirmed.${comment ? ` Note: ${comment}` : ''}`,
        type: 'cancellation_confirmed',
        referenceId: application_id,
        referenceTable: 'leave_applications',
      })

      try {
        await sendEmail({
          to: employee.email,
          subject: 'Leave Cancellation Confirmed',
          html: `
            <h2>Leave Cancellation Confirmed</h2>
            <p>Your leave cancellation request has been confirmed.</p>
            <p><strong>Leave Dates:</strong> ${app.from_date} to ${app.to_date}</p>
            ${comment ? `<p><strong>Note:</strong> ${comment}</p>` : ''}
            <hr />
            <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
          `,
        })
      } catch (emailErr) {
        console.error('Cancellation confirmed email failed:', emailErr)
      }

      return ok({ application_id, status: 'cancelled' })
    } else {
      await supabase
        .from('leave_applications')
        .update({
          cancellation_requested: false,
          reviewer_comment: comment ?? null,
        })
        .eq('id', application_id)

      await createNotification({
        recipientId: app.employee_id,
        title: 'Leave Cancellation Rejected',
        body: `Your leave cancellation request was not approved.${comment ? ` Reason: ${comment}` : ''}`,
        type: 'cancellation_rejected',
        referenceId: application_id,
        referenceTable: 'leave_applications',
      })

      try {
        await sendEmail({
          to: employee.email,
          subject: 'Leave Cancellation Rejected',
          html: `
            <h2>Leave Cancellation Rejected</h2>
            <p>Your leave cancellation request was not approved.</p>
            <p><strong>Leave Dates:</strong> ${app.from_date} to ${app.to_date}</p>
            ${comment ? `<p><strong>Reason:</strong> ${comment}</p>` : ''}
            <hr />
            <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
          `,
        })
      } catch (emailErr) {
        console.error('Cancellation rejected email failed:', emailErr)
      }

      return ok({ application_id, status: 'approved' })
    }
  } catch (e) {
    return handleError(e)
  }
})
