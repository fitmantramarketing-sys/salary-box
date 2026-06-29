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

    const { request_id, action, comment } = await req.json()

    if (!request_id || !['approve', 'reject'].includes(action)) {
      return err('VALIDATION_ERROR', 'request_id and action (approve|reject) are required')
    }

    const supabase = getServiceClient()

    const { data: request, error: reqErr } = await supabase
      .from('comp_off_requests')
      .select('*, employees!inner(id, email)')
      .eq('id', request_id)
      .single()

    if (reqErr || !request) {
      return err('NOT_FOUND', 'Comp-off request not found')
    }

    if (request.status !== 'pending') {
      return err('CONFLICT', `Comp-off request is already ${request.status}`)
    }

    await supabase
      .from('comp_off_requests')
      .update({
        status: action,
        reviewed_by: actor.actorId,
        reviewed_at: new Date().toISOString(),
        reviewer_comment: comment ?? null,
      })
      .eq('id', request_id)

    if (action === 'approve') {
      const { data: config } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'comp_off_expiry_days')
        .maybeSingle()

      const expiryDays = config ? parseInt(config.value) : 60
      const workedDate = new Date(request.worked_date + 'T00:00:00Z')
      workedDate.setUTCDate(workedDate.getUTCDate() + expiryDays)
      const compOffExpiryDate = workedDate.toISOString().split('T')[0]

      const { data: compOffType } = await supabase
        .from('leave_types')
        .select('id')
        .eq('name', 'Comp-Off')
        .eq('is_active', true)
        .maybeSingle()

      let compOffTypeId = compOffType?.id
      if (!compOffTypeId) {
        const { data: lt } = await supabase
          .from('leave_types')
          .select('id')
          .eq('is_active', true)
          .ilike('name', '%comp%off%')
          .maybeSingle()

        if (lt) compOffTypeId = lt.id
      }

      if (compOffTypeId) {
        const year = request.worked_date.substring(0, 4)
        const { data: balance } = await supabase
          .from('leave_balances')
          .select('*')
          .eq('employee_id', request.employee_id)
          .eq('leave_type_id', compOffTypeId)
          .eq('year', year)
          .maybeSingle()

        if (balance) {
          await supabase
            .from('leave_balances')
            .update({ accrued: balance.accrued + 1 })
            .eq('id', balance.id)

          await supabase
            .from('comp_off_requests')
            .update({
              comp_off_expiry_date: compOffExpiryDate,
              leave_balance_id: balance.id,
            })
            .eq('id', request_id)
        } else {
          const { data: newBalance } = await supabase
            .from('leave_balances')
            .insert({
              employee_id: request.employee_id,
              leave_type_id: compOffTypeId,
              year,
              opening_balance: 0,
              accrued: 1,
              taken: 0,
              pending: 0,
              adjusted: 0,
            })
            .select()
            .single()

          if (newBalance) {
            await supabase
              .from('comp_off_requests')
              .update({
                comp_off_expiry_date: compOffExpiryDate,
                leave_balance_id: newBalance.id,
              })
              .eq('id', request_id)
          }
        }
      }

      await supabase
        .from('comp_off_requests')
        .update({ comp_off_expiry_date: compOffExpiryDate })
        .eq('id', request_id)

      await createNotification({
        recipientId: request.employee_id,
        title: 'Comp-Off Approved',
        body: `Your comp-off request for ${request.worked_date} has been approved. Expires on ${compOffExpiryDate}.`,
        type: 'comp_off_approved',
        referenceId: request_id,
        referenceTable: 'comp_off_requests',
      })

      try {
        const empEmail = (request.employees as unknown as { email: string }).email
        await sendEmail({
          to: empEmail,
          subject: 'Comp-Off Approved',
          html: `
            <h2>Comp-Off Approved</h2>
            <p>Your comp-off request for <strong>${request.worked_date}</strong> has been approved.</p>
            <p>Expires on <strong>${compOffExpiryDate}</strong>. Please use it before it lapses.</p>
            <hr />
            <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
          `,
        })
      } catch (emailErr) {
        console.error('Comp-off approved email failed:', emailErr)
      }

      return ok({
        request_id,
        status: 'approved',
        comp_off_expiry_date: compOffExpiryDate,
      })
    } else {
      await createNotification({
        recipientId: request.employee_id,
        title: 'Comp-Off Rejected',
        body: `Your comp-off request for ${request.worked_date} has been rejected.${comment ? ` Reason: ${comment}` : ''}`,
        type: 'comp_off_rejected',
        referenceId: request_id,
        referenceTable: 'comp_off_requests',
      })

      try {
        const empEmail = (request.employees as unknown as { email: string }).email
        await sendEmail({
          to: empEmail,
          subject: 'Comp-Off Rejected',
          html: `
            <h2>Comp-Off Rejected</h2>
            <p>Your comp-off request for <strong>${request.worked_date}</strong> has been rejected.</p>
            ${comment ? `<p><strong>Reviewer Note:</strong> ${comment}</p>` : ''}
            <hr />
            <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
          `,
        })
      } catch (emailErr) {
        console.error('Comp-off rejected email failed:', emailErr)
      }

      return ok({ request_id, status: 'rejected', comp_off_expiry_date: null })
    }
  } catch (e) {
    return handleError(e)
  }
})
