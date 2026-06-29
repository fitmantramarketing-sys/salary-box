import { getServiceClient } from '../_shared/supabase.ts'
import { ok, cors, handleError } from '../_shared/response.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'

// Cron: daily at 23:55 IST (BR-EMP-05)
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const supabase = getServiceClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: employees, error: fetchError } = await supabase
      .from('employees')
      .select('id, auth_id, first_name, last_name, employee_code, email')
      .eq('exit_date', today)
      .eq('is_active', true)

    if (fetchError) throw fetchError

    if (!employees?.length) {
      return ok({ processed: 0, message: 'No employees to deactivate today' })
    }

    const { data: admins } = await supabase
      .from('employees')
      .select('id, email')
      .in('role', ['owner', 'hr'])
      .eq('is_active', true)

    let processed = 0
    const errors: { id: string; error: string }[] = []

    for (const emp of employees) {
      // Deactivate the employee record
      const { error: updateError } = await supabase
        .from('employees')
        .update({ is_active: false })
        .eq('id', emp.id)

      if (updateError) {
        errors.push({ id: emp.id, error: updateError.message })
        continue
      }

      // Revoke auth account access
      if (emp.auth_id) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(emp.auth_id)
        if (deleteError) {
          errors.push({ id: emp.id, error: `Auth revoke failed: ${deleteError.message}` })
        }
      }

      // Notify HR/Owner
      if (admins) {
        for (const admin of admins) {
          await createNotification({
            recipientId: admin.id,
            title: 'Employee Access Revoked',
            body: `Access revoked for ${emp.first_name} ${emp.last_name} (${emp.employee_code}) — exit date was ${today}.`,
            type: 'access_revoked',
          })
        }
        try {
          const adminEmails = admins.map((a) => a.email).filter(Boolean).join(',')
          if (adminEmails) {
            await sendEmail({
              to: adminEmails,
              subject: 'Employee Access Revoked',
              html: `
                <h2>Employee Access Revoked</h2>
                <p>Access has been revoked for <strong>${emp.first_name} ${emp.last_name}</strong> (${emp.employee_code}).</p>
                <p><strong>Exit Date:</strong> ${today}</p>
                <hr />
                <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
              `,
            })
          }
        } catch (emailErr) {
          console.error(`Access revocation email failed for ${emp.employee_code}:`, emailErr)
        }
      }

      processed++
    }

    return ok({ processed, total: employees.length, errors: errors.length > 0 ? errors : undefined })
  } catch (e) {
    return handleError(e)
  }
})
