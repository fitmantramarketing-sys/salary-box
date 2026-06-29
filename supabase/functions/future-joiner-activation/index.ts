import { getServiceClient } from '../_shared/supabase.ts'
import { ok, cors, handleError } from '../_shared/response.ts'
import { sendEmail } from '../_shared/email.ts'

// Cron: daily at 00:01 IST (BR-EMP-03)
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const supabase = getServiceClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: employees, error: fetchError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, employee_code, email, is_first_login')
      .eq('employment_status', 'future_joiner')
      .eq('join_date', today)

    if (fetchError) throw fetchError

    if (!employees?.length) {
      return ok({ processed: 0, message: 'No future joiners to activate today' })
    }

    let processed = 0
    const errors: string[] = []

    for (const emp of employees) {
      const { error: updateError } = await supabase
        .from('employees')
        .update({ employment_status: 'active' })
        .eq('id', emp.id)

      if (updateError) {
        errors.push(`${emp.employee_code}: ${updateError.message}`)
        continue
      }

      // Send welcome email
      try {
        await sendEmail({
          to: emp.email,
          subject: 'Welcome to the company — your account is active',
          html: `
            <h2>Welcome, ${emp.first_name}!</h2>
            <p>Your employment starts today. Your account is now active.</p>
            <p><strong>Employee Code:</strong> ${emp.employee_code}</p>
            <p><strong>Email:</strong> ${emp.email}</p>
            <p>Please log in at the company HR portal to get started.</p>
            <hr />
            <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
          `,
        })
      } catch (emailErr) {
        console.error(`Welcome email failed for ${emp.employee_code}:`, emailErr)
      }

      // Create in-app notification for Owner and HR
      const { data: recipients } = await supabase
        .from('employees')
        .select('id')
        .in('role', ['owner', 'hr'])
        .eq('is_active', true)

      if (recipients?.length) {
        const notifications = recipients.map((r) => ({
          recipient_id: r.id,
          type: 'employee_activated' as const,
          title: 'Employee activated',
          body: `${emp.first_name} ${emp.last_name} (${emp.employee_code}) has been activated today.`,
          is_read: false,
        }))

        await supabase.from('notifications').insert(notifications)
      }

      processed++
    }

    return ok({ processed, total: employees.length, errors: errors.length > 0 ? errors : undefined })
  } catch (e) {
    return handleError(e)
  }
})
