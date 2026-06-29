import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const supabase = getServiceClient()

    const plus7 = new Date()
    plus7.setDate(plus7.getDate() + 7)
    const target7 = plus7.toISOString().split('T')[0]

    const { data: requests } = await supabase
      .from('comp_off_requests')
      .select('*, employees!comp_off_requests_employee_id_fkey(email)')
      .eq('status', 'approved')
      .eq('comp_off_expiry_date', target7)

    if (!requests) return ok({ processed: 0 })

    let processed = 0

    for (const req of requests) {
      const empEmail = (req.employees as unknown as { email: string }).email
      await createNotification({
        recipientId: req.employee_id,
        title: 'Comp-Off Expiring Soon',
        body: `Your comp-off for ${req.worked_date} will expire in 7 days (${req.comp_off_expiry_date}). Please use it before it lapses.`,
        type: 'comp_off_expiry_alert',
        referenceId: req.id,
        referenceTable: 'comp_off_requests',
      })

      try {
        await sendEmail({
          to: empEmail,
          subject: 'Comp-Off Expiring in 7 Days',
          html: `
            <h2>Comp-Off Expiring Soon</h2>
            <p>Your comp-off for <strong>${req.worked_date}</strong> will expire in <strong>7 days</strong> (${req.comp_off_expiry_date}).</p>
            <p>Please use it before it lapses.</p>
            <hr />
            <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
          `,
        })
      } catch (emailErr) {
        console.error(`Comp-off expiry email failed for ${req.employee_id}:`, emailErr)
      }

      processed++
    }

    return ok({ processed })
  } catch (e) {
    return handleError(e)
  }
})
