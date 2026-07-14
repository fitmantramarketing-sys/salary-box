import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const supabase = getServiceClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: incomplete } = await supabase
      .from('attendance_records')
      .select('id, employee_id, check_in_time, status, employees!attendance_records_employee_id_fkey!inner(email, role)')
      .eq('date', today)
      .not('check_in_time', 'is', null)
      .is('check_out_time', null)
      .neq('employees.role', 'owner')
      .neq('is_manually_entered', true)
      .neq('status', 'absent')

    if (!incomplete || incomplete.length === 0) {
      return ok({ processed: 0 })
    }

    let processed = 0
    for (const record of incomplete) {
      try {
        const { error: updateError } = await supabase
          .from('attendance_records')
          .update({ status: 'incomplete' })
          .eq('id', record.id)

        if (!updateError) {
          processed++
          const empEmail = (record.employees as unknown as { email: string }).email
          await createNotification({
            recipientId: record.employee_id,
            title: 'Incomplete Attendance',
            body: `Your attendance for ${today} is incomplete due to a missing check-out. Please submit a regularization request.`,
            type: 'attendance_incomplete',
            referenceId: record.id,
            referenceTable: 'attendance_records',
          })
          try {
            await sendEmail({
              to: empEmail,
              subject: 'Incomplete Attendance',
              html: `
                <h2>Incomplete Attendance</h2>
                <p>You checked in today (<strong>${today}</strong>) but did not check out.</p>
                <p>Your status has been marked as <strong>incomplete</strong>. Please submit a regularization request to correct this.</p>
                <hr />
                <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
              `,
            })
          } catch (emailErr) {
            console.error(`Auto-checkout email failed for ${record.employee_id}:`, emailErr)
          }
        }
      } catch {
        continue
      }
    }

    return ok({ processed })
  } catch (e) {
    return handleError(e)
  }
})
