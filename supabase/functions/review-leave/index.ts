import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError, err } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'
import { countWorkingDays } from '../_shared/working-days.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr'])

    const { application_id, action, comment } = await req.json()

    if (!application_id || !['approve', 'reject'].includes(action)) {
      return err('VALIDATION_ERROR', 'application_id and action (approve|reject) are required')
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

    if (app.status !== 'pending') {
      return err('CONFLICT', `Leave application is already ${app.status}`)
    }

    const { data: employee } = await supabase
      .from('employees')
      .select('id, email')
      .eq('id', app.employee_id)
      .single()

    if (!employee) {
      return err('NOT_FOUND', 'Employee not found')
    }

    if (action === 'approve') {
      await supabase
        .from('leave_applications')
        .update({
          status: 'approved',
          reviewed_by: actor.actorId,
          reviewed_at: new Date().toISOString(),
          reviewer_comment: comment ?? null,
        })
        .eq('id', application_id)

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
          .update({
            taken: balance.taken + app.working_days_count,
            pending: Math.max(0, balance.pending - app.working_days_count),
          })
          .eq('id', balance.id)
      }

      const wd = await countWorkingDays(app.employee_id, app.from_date, app.to_date)
      let dateCursor = new Date(app.from_date + 'T00:00:00Z')
      const endDate = new Date(app.to_date + 'T00:00:00Z')

      while (dateCursor <= endDate) {
        const dateStr = dateCursor.toISOString().split('T')[0]

        const { data: existing } = await supabase
          .from('attendance_records')
          .select('id, status')
          .eq('employee_id', app.employee_id)
          .eq('date', dateStr)
          .maybeSingle()

        if (existing) {
          if (existing.status === 'present' || existing.status === 'work_from_home') {
            await createNotification({
              recipientId: actor.actorId,
              title: 'Attendance Conflict',
              body: `Employee has a conflicting attendance record (${existing.status}) on ${dateStr} for approved leave.`,
              type: 'attendance_conflict',
              referenceId: existing.id,
              referenceTable: 'attendance_records',
            })
          } else {
            await supabase
              .from('attendance_records')
              .update({ status: 'on_leave' })
              .eq('id', existing.id)
          }
        } else {
          await supabase
            .from('attendance_records')
            .insert({
              employee_id: app.employee_id,
              date: dateStr,
              status: 'on_leave',
            })
        }

        dateCursor.setUTCDate(dateCursor.getUTCDate() + 1)
      }

      await createNotification({
        recipientId: app.employee_id,
        title: 'Leave Approved',
        body: `Your ${app.reason} leave (${app.from_date} to ${app.to_date}) has been approved.`,
        type: 'leave_approved',
        referenceId: application_id,
        referenceTable: 'leave_applications',
      })

      try {
        await sendEmail({
          to: employee.email,
          subject: 'Leave Approved',
          html: `
            <h2>Leave Approved</h2>
            <p>Your leave request has been approved.</p>
            <p><strong>Reason:</strong> ${app.reason}</p>
            <p><strong>Dates:</strong> ${app.from_date} to ${app.to_date}</p>
            <p><strong>Working Days:</strong> ${app.working_days_count}</p>
            ${comment ? `<p><strong>Reviewer Note:</strong> ${comment}</p>` : ''}
            <hr />
            <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
          `,
        })
      } catch (emailErr) {
        console.error('Leave approved email failed:', emailErr)
      }

      return ok({ application_id, status: 'approved' })
    } else {
      await supabase
        .from('leave_applications')
        .update({
          status: 'rejected',
          reviewed_by: actor.actorId,
          reviewed_at: new Date().toISOString(),
          reviewer_comment: comment ?? null,
        })
        .eq('id', application_id)

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
          .update({ pending: Math.max(0, balance.pending - app.working_days_count) })
          .eq('id', balance.id)
      }

      await createNotification({
        recipientId: app.employee_id,
        title: 'Leave Rejected',
        body: `Your ${app.reason} leave (${app.from_date} to ${app.to_date}) has been rejected.${comment ? ` Reason: ${comment}` : ''}`,
        type: 'leave_rejected',
        referenceId: application_id,
        referenceTable: 'leave_applications',
      })

      try {
        await sendEmail({
          to: employee.email,
          subject: 'Leave Rejected',
          html: `
            <h2>Leave Rejected</h2>
            <p>Your leave request has been rejected.</p>
            <p><strong>Reason:</strong> ${app.reason}</p>
            <p><strong>Dates:</strong> ${app.from_date} to ${app.to_date}</p>
            ${comment ? `<p><strong>Reviewer Note:</strong> ${comment}</p>` : ''}
            <hr />
            <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
          `,
        })
      } catch (emailErr) {
        console.error('Leave rejected email failed:', emailErr)
      }

      return ok({ application_id, status: 'rejected' })
    }
  } catch (e) {
    return handleError(e)
  }
})
