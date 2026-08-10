import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, err, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { sendEmail } from '../_shared/email.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner'])

    const body = await req.json()
    const { employee_id, new_email } = body

    if (!employee_id || !new_email) {
      return err('VALIDATION_ERROR', 'employee_id and new_email are required', 400)
    }

    const normalizedEmail = String(new_email).trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return err('VALIDATION_ERROR', 'new_email must be a valid email address', 400)
    }

    const supabase = getServiceClient()

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, email, auth_id, is_active')
      .eq('id', employee_id)
      .maybeSingle()

    if (empError || !employee) {
      return err('NOT_FOUND', 'Employee not found', 404)
    }

    if (!employee.is_active) {
      return err('VALIDATION_ERROR', 'Cannot change login email of a deactivated employee', 400)
    }

    if (normalizedEmail === employee.email.toLowerCase()) {
      return err('VALIDATION_ERROR', 'New email is the same as the current email', 400)
    }

    if (!employee.auth_id) {
      return err('VALIDATION_ERROR', 'This employee has no auth account linked (auth_id is null)', 400)
    }

    const { data: emailTaken } = await supabase
      .from('employees')
      .select('id')
      .eq('email', normalizedEmail)
      .neq('id', employee_id)
      .maybeSingle()

    if (emailTaken) {
      return err('DUPLICATE', `An employee with email ${normalizedEmail} already exists`, 409)
    }

    const srKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const filterRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(normalizedEmail)}`,
      { headers: { Authorization: `Bearer ${srKey}`, apikey: srKey } }
    )
    if (filterRes.ok) {
      const { users: filteredUsers } = await filterRes.json()
      const takenUser = filteredUsers?.find((u: { email: string }) => u.email === normalizedEmail)
      if (takenUser?.id && takenUser.id !== employee.auth_id) {
        return err('DUPLICATE', `Email ${normalizedEmail} is already registered as a login`, 409)
      }
    }

    const { error: authError } = await supabase.auth.admin.updateUserById(employee.auth_id, {
      email: normalizedEmail,
      email_confirm: true,
    })
    if (authError) {
      console.error('Auth email update error:', authError)
      return err('INTERNAL_ERROR', `Failed to update auth email: ${authError.message}`, 500)
    }

    const { error: updateError } = await supabase
      .from('employees')
      .update({ email: normalizedEmail })
      .eq('id', employee_id)

    if (updateError) {
      console.error('Employee email update error:', updateError)
      return err('INTERNAL_ERROR', `Failed to update employee email: ${updateError.message}`, 500)
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://salary-box-sigma.vercel.app'
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: 'Your login email has been updated',
        html: `
          <h2>Login email updated, ${employee.first_name}!</h2>
          <p>Your HR portal login email has been changed.</p>
          <p><strong>New login email:</strong> ${normalizedEmail}</p>
          <p>Please use this email address to sign in from now on. If you have forgotten your password, use the "Forgot Password" link on the login page and a reset link will be sent to this address.</p>
          <p><a href="${siteUrl}/login" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">Go to the HR Portal</a></p>
          <hr />
          <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
        `,
      })
    } catch (emailErr) {
      console.error('Login email change notification failed (non-fatal):', emailErr)
    }

    return ok({
      employee_id: employee.id,
      email: normalizedEmail,
      changed_by: actor.actorId,
    })
  } catch (e) {
    return handleError(e)
  }
})
