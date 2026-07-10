import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError, err } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { countWorkingDays } from '../_shared/working-days.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr', 'employee'])

const {
  leave_type_id,
  from_date,
  to_date,
  is_half_day = false,
  half_day_period = null,
  reason,
  attachment_path = null,
  use_paid_for_excess,
} = await req.json()

    if (!leave_type_id || !from_date || !to_date || !reason) {
      return err('VALIDATION_ERROR', 'leave_type_id, from_date, to_date, and reason are required')
    }
    if (new Date(to_date) < new Date(from_date)) {
      return err('VALIDATION_ERROR', 'to_date must be on or after from_date')
    }
    if (is_half_day && !['morning', 'afternoon'].includes(half_day_period)) {
      return err('VALIDATION_ERROR', 'half_day_period must be morning or afternoon when is_half_day is true')
    }

    const supabase = getServiceClient()

    const { data: leaveType, error: ltErr } = await supabase
      .from('leave_types')
      .select('*')
      .eq('id', leave_type_id)
      .eq('is_active', true)
      .single()

    if (ltErr || !leaveType) {
      return err('NOT_FOUND', 'Leave type not found or inactive')
    }

    const { data: employee, error: empErr } = await supabase
      .from('employees')
      .select('gender, reporting_manager_id')
      .eq('id', actor.actorId)
      .single()

    if (empErr || !employee) {
      return err('NOT_FOUND', 'Employee not found')
    }

    if (leaveType.applicable_gender && employee.gender !== leaveType.applicable_gender) {
      return err('VALIDATION_ERROR', 'This leave type is not applicable to your gender')
    }

    const isManagerExempt = actor.actorRole === 'owner' || actor.actorRole === 'hr'
    if (!isManagerExempt && leaveType.min_notice_days > 0) {
      const earliestStart = new Date()
      earliestStart.setDate(earliestStart.getDate() + leaveType.min_notice_days)
      const startDate = new Date(from_date + 'T00:00:00')
      if (startDate < earliestStart) {
        return err('VALIDATION_ERROR', `This leave type requires ${leaveType.min_notice_days} days advance notice. Earliest allowed start date is ${earliestStart.toISOString().split('T')[0]}.`)
      }
    }

    let workingDays = await countWorkingDays(actor.actorId, from_date, to_date)
    if (is_half_day) workingDays = 0.5

    if (workingDays <= 0) {
      return err('VALIDATION_ERROR', 'Selected dates contain no working days')
    }

    if (leaveType.max_consecutive_days && workingDays > leaveType.max_consecutive_days) {
      return err('VALIDATION_ERROR', `This leave type allows a maximum of ${leaveType.max_consecutive_days} consecutive working days per application`)
    }

    if (leaveType.requires_attachment || (leaveType.attachment_required_after_days && workingDays > leaveType.attachment_required_after_days)) {
      if (!attachment_path) {
        return err('VALIDATION_ERROR', 'Attachment is required for this leave type/duration')
      }
    }

    // Compute paid_days and lwp_days
    let lwpDays = 0

    if (leaveType.is_lwp) {
      // LWP application: all days unpaid, no balance impact
      lwpDays = workingDays
    } else {
      // Monthly cap check: count PAID (non-LWP) applications this month
      const fromMonthStart = from_date.substring(0, 7) + '-01'
      const fromMonthEnd = from_date.substring(0, 7) + '-31'

      const { data: monthLeaves } = await supabase
        .from('leave_applications')
        .select('working_days_count, lwp_days')
        .eq('employee_id', actor.actorId)
        .in('status', ['pending', 'approved'])
        .gte('from_date', fromMonthStart)
        .lte('from_date', fromMonthEnd)

      const monthlyPaidConsumed = (monthLeaves ?? []).reduce(
        (sum, l) => sum + ((l.working_days_count ?? 0) - (l.lwp_days ?? 0)), 0
      )

      const remainingMonthlyCap = Math.max(0, (leaveType.max_per_month ?? 99) - monthlyPaidConsumed)

      if (workingDays > remainingMonthlyCap) {
        // Exceeds monthly cap — decide what to do with excess
        if (use_paid_for_excess) {
          // Employee chose to use yearly balance for excess days
          // All days paid (monthly cap is a soft guideline)
          lwpDays = 0
        } else {
          // Excess days are Leave Without Pay
          lwpDays = workingDays - remainingMonthlyCap
        }
      }
    }

    const { data: overlap, error: ovErr } = await supabase
      .from('leave_applications')
      .select('id, status')
      .eq('employee_id', actor.actorId)
      .in('status', ['pending', 'approved'])
      .lte('from_date', to_date)
      .gte('to_date', from_date)
      .maybeSingle()

    if (ovErr) throw ovErr
    if (overlap) {
      return err('CONFLICT', `You already have a ${overlap.status} leave for this period. Please cancel it first.`)
    }

    const paidDays = workingDays - lwpDays

    if (!leaveType.is_lwp) {
      const year = from_date.substring(0, 4)

      const { data: balance, error: balErr } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', actor.actorId)
        .eq('leave_type_id', leave_type_id)
        .eq('year', year)
        .maybeSingle()

      if (balErr) throw balErr

      const available = balance
        ? (balance.opening_balance + balance.accrued + balance.adjusted) - balance.taken - balance.pending
        : 0

      if (paidDays > available) {
        if (!leaveType.allow_negative_balance) {
          return err('VALIDATION_ERROR', `Insufficient balance. Available: ${available} days. Requested paid: ${paidDays} days.`)
        }
      }

      if (balance) {
        await supabase
          .from('leave_balances')
          .update({ pending: balance.pending + paidDays })
          .eq('id', balance.id)
      }
    }

    const { data: application, error: insErr } = await supabase
      .from('leave_applications')
      .insert({
        employee_id: actor.actorId,
        leave_type_id,
        from_date,
        to_date,
        is_half_day,
        half_day_period: is_half_day ? half_day_period : null,
        reason,
        attachment_path,
        working_days_count: workingDays,
        lwp_days: lwpDays,
        status: 'pending',
        applied_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insErr) throw insErr

    let escalatedTo: string | null = null

    if (employee.reporting_manager_id) {
      const { data: mgrLeave } = await supabase
        .from('leave_applications')
        .select('id')
        .eq('employee_id', employee.reporting_manager_id)
        .eq('status', 'approved')
        .lte('from_date', to_date)
        .gte('to_date', from_date)
        .maybeSingle()

      if (mgrLeave) {
        const { data: owner } = await supabase
          .from('employees')
          .select('id')
          .eq('role', 'owner')
          .eq('is_active', true)
          .maybeSingle()

        if (owner) {
          escalatedTo = owner.id
          await supabase
            .from('leave_applications')
            .update({ escalated_to: owner.id, escalated_at: new Date().toISOString() })
            .eq('id', application.id)
        }
      }
    }

    const { data: approvers } = await supabase
      .from('employees')
      .select('id, email')
      .in('role', ['owner', 'hr'])
      .eq('is_active', true)

    const notifyTargets = escalatedTo
      ? approvers?.filter(a => a.id === escalatedTo) ?? []
      : approvers ?? []

    for (const approver of notifyTargets) {
      await createNotification({
        recipientId: approver.id,
        title: 'Leave Application Submitted',
        body: `${reason}`,
        type: 'leave_submitted',
        referenceId: application.id,
        referenceTable: 'leave_applications',
      })
    }

    try {
      const targetEmails = notifyTargets.map((a) => a.email).filter(Boolean).join(',')
      if (targetEmails) {
        await sendEmail({
          to: targetEmails,
          subject: 'Leave Application Submitted',
          html: `
            <h2>Leave Application Submitted</h2>
            <p><strong>Reason:</strong> ${reason}</p>
            <p><strong>Dates:</strong> ${from_date} to ${to_date}</p>
            <p><strong>Working Days:</strong> ${workingDays}${escalatedTo ? '<br/><em>Escalated to Owner (manager on leave)</em>' : ''}</p>
            <p>Please review the application in the HR portal.</p>
            <hr />
            <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
          `,
        })
      }
    } catch (emailErr) {
      console.error('Leave submission email failed:', emailErr)
    }

    return ok({
      application_id: application.id,
      working_days_count: workingDays,
      status: 'pending',
      escalated_to: escalatedTo,
    }, 201)
  } catch (e) {
    return handleError(e)
  }
})
