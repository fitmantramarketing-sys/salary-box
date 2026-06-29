import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'
import { countWorkingDays } from '../_shared/working-days.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const supabase = getServiceClient()

    const { data: config } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'leave_sla_business_days')
      .maybeSingle()

    const slaDays = config ? parseInt(config.value) : 3

    const { data: owner } = await supabase
      .from('employees')
      .select('id, email')
      .eq('role', 'owner')
      .eq('is_active', true)
      .maybeSingle()

    if (!owner) return ok({ processed: 0 })

    const { data: pendingApps } = await supabase
      .from('leave_applications')
      .select('*')
      .eq('status', 'pending')
      .is('escalated_to', null)

    if (!pendingApps) return ok({ processed: 0 })

    let processed = 0

    for (const app of pendingApps) {
      const appliedAt = app.applied_at?.split('T')[0]
      if (!appliedAt) continue

      const businessDaysSince = await countWorkingDays(
        app.employee_id,
        appliedAt,
        new Date().toISOString().split('T')[0]
      )

      if (businessDaysSince >= slaDays) {
        await supabase
          .from('leave_applications')
          .update({
            escalated_to: owner.id,
            escalated_at: new Date().toISOString(),
          })
          .eq('id', app.id)

        await createNotification({
          recipientId: owner.id,
          title: 'Leave SLA Breached',
          body: `Leave request from employee has been pending for ${businessDaysSince} business days.`,
          type: 'leave_sla_escalation',
          referenceId: app.id,
          referenceTable: 'leave_applications',
        })

        try {
          await sendEmail({
            to: owner.email,
            subject: 'Leave SLA Breached',
            html: `
              <h2>Leave SLA Breached</h2>
              <p>A leave request has been pending for <strong>${businessDaysSince} business days</strong>.</p>
              <p>Please review the application in the HR portal.</p>
              <hr />
              <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
            `,
          })
        } catch (emailErr) {
          console.error('Leave SLA escalation email failed:', emailErr)
        }

        processed++
      }
    }

    return ok({ processed })
  } catch (e) {
    return handleError(e)
  }
})
