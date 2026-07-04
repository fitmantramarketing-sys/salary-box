import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const supabase = getServiceClient()
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

    const { data: incomplete } = await supabase
      .from('attendance_records')
      .select('id, employee_id, employees!attendance_records_employee_id_fkey!inner(email, role)')
      .eq('date', yesterday)
      .eq('status', 'incomplete')
      .neq('employees.role', 'owner')

    if (!incomplete || incomplete.length === 0) {
      return ok({ processed: 0 })
    }

    for (const record of incomplete) {
      const empEmail = (record.employees as unknown as { email: string }).email
      await createNotification({
        recipientId: record.employee_id,
        title: 'Incomplete Attendance',
        body: `Your attendance for ${yesterday} was incomplete. Would you like to submit a regularization request?`,
        type: 'attendance_incomplete',
        referenceId: record.id,
        referenceTable: 'attendance_records',
      })
      try {
        await sendEmail({
          to: empEmail,
          subject: 'Incomplete Attendance Reminder',
          html: `
            <h2>Incomplete Attendance</h2>
            <p>Your attendance for <strong>${yesterday}</strong> was incomplete.</p>
            <p>Please submit a regularization request in the HR portal to correct this.</p>
            <hr />
            <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
          `,
        })
      } catch (emailErr) {
        console.error(`Incomplete attendance email failed for ${record.employee_id}:`, emailErr)
      }
    }

    return ok({ processed: incomplete.length })
  } catch (e) {
    return handleError(e)
  }
})
