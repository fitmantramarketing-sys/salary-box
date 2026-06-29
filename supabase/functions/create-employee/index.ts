import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError, err } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { sendEmail } from '../_shared/email.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner'])

    const body = await req.json()
    const {
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      gender,
      personal_email,
      address_line1,
      address_line2,
      city,
      state,
      pincode,
      emergency_contact_name,
      emergency_contact_phone,
      department_id,
      designation_id,
      reporting_manager_id,
      role = 'employee',
      employment_type = 'full_time',
      join_date,
      probation_end_date,
      current_salary,
      leave_allocations = [],
    } = body

    // Validate required fields
    if (!first_name || !last_name || !email || !join_date) {
      return err('VALIDATION_ERROR', 'first_name, last_name, email, and join_date are required')
    }

    const supabase = getServiceClient()

    // 1. Check email uniqueness
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return err('DUPLICATE', `An employee with email ${email} already exists`, 409)
    }

    // 2. Auto-generate employee_code (EMP-YYYY-NNNN)
    const year = new Date().getFullYear().toString()
    const { count } = await supabase
      .from('employees')
      .select('*', { head: true, count: 'exact' })
      .like('employee_code', `EMP-${year}-%`)

    const nextSeq = ((count ?? 0) + 1).toString().padStart(4, '0')
    const employeeCode = `EMP-${year}-${nextSeq}`

    // 3. Determine employment_status
    const today = new Date().toISOString().split('T')[0]
    const parsedJoinDate = join_date.split('T')[0] ?? join_date
    const employmentStatus = parsedJoinDate > today ? 'future_joiner' : 'active'

    // 4. Insert employees row
    const { data: employee, error: insertError } = await supabase
      .from('employees')
      .insert({
        employee_code: employeeCode,
        first_name,
        last_name,
        email,
        phone: phone || null,
        date_of_birth: date_of_birth || null,
        gender: gender || null,
        personal_email: personal_email || null,
        address_line1: address_line1 || null,
        address_line2: address_line2 || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null,
        department_id: department_id || null,
        designation_id: designation_id || null,
        reporting_manager_id: reporting_manager_id || null,
        role,
        employment_type,
        employment_status: employmentStatus,
        join_date: parsedJoinDate,
        probation_end_date: probation_end_date || null,
        current_salary: current_salary || null,
        is_first_login: true,
        is_active: true,
        created_by: actor.actorId,
      })
      .select('id')
      .single()

    if (insertError || !employee) {
      console.error('Employee insert error:', insertError)
      return err('INTERNAL_ERROR', 'Failed to create employee record', 500)
    }

    // 5. Create Supabase Auth account (delete existing auth user first if present)
    const tempPassword = crypto.randomUUID().slice(0, 16)
    let authUserId: string | null = null

    // Try creating the auth user. If email is already taken, find and delete the
    // orphaned auth user first, then retry (handles manual employee deletion).
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { employee_id: employee.id, employee_code: employeeCode },
      })

      if (authData?.user) {
        authUserId = authData.user.id
        break
      }

      if (attempt === 1 || !authError?.message?.includes('already been registered')) {
        await supabase.from('employees').delete().eq('id', employee.id)
        return err('INTERNAL_ERROR', `Failed to create auth account: ${authError?.message ?? 'No user returned'}`, 500)
      }

      // Auth user exists — find and delete it, then retry
      const { data: usersPage } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 })
      const existingUser = usersPage?.users?.find((u) => u.email === email)
      if (existingUser) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id)
        if (deleteError) {
          console.error('Failed to delete orphaned auth user:', deleteError.message)
        }
      }
    }

    // Explicitly confirm the user's email as a defense-in-depth measure
    // (works even if project-level mailer_autoconfirm is disabled)
    if (authUserId) {
      const { error: confirmError } = await supabase.auth.admin.updateUserById(
        authUserId,
        { email_confirm: true }
      )
      if (confirmError) {
        console.error('Failed to confirm email (non-fatal):', confirmError.message)
      }
    }

    // Link auth_id to employee
    await supabase
      .from('employees')
      .update({ auth_id: authUserId })
      .eq('id', employee.id)

    // 6. Send welcome email (best-effort — don't fail the request)
    try {
      await sendEmail({
        to: email,
        subject: `Welcome to the company — your account is ready`,
        html: `
          <h2>Welcome, ${first_name}!</h2>
          <p>Your employee account has been created.</p>
          <p><strong>Employee Code:</strong> ${employeeCode}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <p>Please log in at the company HR portal and set a new password on first login.</p>
          <hr />
          <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
        `,
      })
    } catch (emailErr) {
      console.error('Welcome email failed (non-fatal):', emailErr)
    }

    // 7. Create employee_onboarding_progress rows from active templates
    const { data: templates } = await supabase
      .from('onboarding_checklist_templates')
      .select('id')
      .eq('is_active', true)

    if (templates && templates.length > 0) {
      const progressRows = templates.map((t) => ({
        employee_id: employee.id,
        checklist_item_id: t.id,
        is_completed: false,
      }))
      await supabase.from('employee_onboarding_progress').insert(progressRows)
    }

    // 8. Create leave_balances rows for current year with owner-assigned allocations
    const currentYear = new Date().getFullYear()
    const { data: leaveTypes } = await supabase
      .from('leave_types')
      .select('id, is_lwp')
      .eq('is_active', true)

    if (leaveTypes && leaveTypes.length > 0) {
      const allocMap = new Map<string, number>(
        (leave_allocations as { leave_type_id: string; days: number }[]).map((a) => [a.leave_type_id, a.days])
      )

      const balanceRows = leaveTypes.map((lt) => ({
        employee_id: employee.id,
        leave_type_id: lt.id,
        year: currentYear,
        opening_balance: lt.is_lwp ? 0 : (allocMap.get(lt.id) ?? 0),
        carry_forward_amount: 0,
        accrued: 0,
        taken: 0,
        pending: 0,
        adjusted: 0,
      }))
      await supabase.from('leave_balances').insert(balanceRows)
    }

    return ok(
      {
        employee_id: employee.id,
        employee_code: employeeCode,
        employment_status: employmentStatus,
        temporary_password: tempPassword,
      },
      201
    )
  } catch (e) {
    return handleError(e)
  }
})
