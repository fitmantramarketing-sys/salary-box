import { getActor } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { ok, err, cors, handleError } from '../_shared/response.ts'

const OWNER_FIELDS = [
  'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'gender',
  'personal_email', 'address_line1', 'address_line2', 'city', 'state', 'pincode',
  'emergency_contact_name', 'emergency_contact_phone', 'guardian_email', 'photo_url',
  'department_id', 'designation_id', 'reporting_manager_id',
  'role', 'employment_type', 'employment_status',
  'join_date', 'exit_date', 'probation_end_date', 'current_salary',
  'is_active',
] as const

const HR_FIELDS = [
  'first_name', 'last_name', 'phone', 'date_of_birth', 'gender',
  'personal_email', 'address_line1', 'address_line2', 'city', 'state', 'pincode',
  'emergency_contact_name', 'emergency_contact_phone', 'guardian_email', 'photo_url',
  'department_id', 'designation_id', 'reporting_manager_id',
  'employment_type', 'employment_status',
  'join_date', 'exit_date', 'probation_end_date',
  'is_active',
] as const

const EMPLOYEE_SELF_FIELDS = [
  'phone', 'personal_email',
  'address_line1', 'address_line2', 'city', 'state', 'pincode',
  'emergency_contact_name', 'emergency_contact_phone', 'guardian_email', 'photo_url',
] as const

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    const body = await req.json()
    const { employee_id, ...updates } = body

    if (!employee_id) {
      return err('VALIDATION_ERROR', 'employee_id is required', 400)
    }

    if (Object.keys(updates).length === 0) {
      return err('VALIDATION_ERROR', 'No fields to update', 400)
    }

    const updateKeys = Object.keys(updates)

    let allowedFields: readonly string[]
    if (actor.actorRole === 'owner') {
      allowedFields = OWNER_FIELDS
    } else if (actor.actorRole === 'hr') {
      allowedFields = HR_FIELDS
    } else if (actor.actorRole === 'employee') {
      if (employee_id !== actor.actorId) {
        return err('FORBIDDEN', 'Employees can only update their own profile', 403)
      }
      allowedFields = EMPLOYEE_SELF_FIELDS
    } else {
      return err('FORBIDDEN', 'Insufficient role for this action', 403)
    }

    const forbidden = updateKeys.filter((k) => !allowedFields.includes(k))
    if (forbidden.length > 0) {
      return err('FORBIDDEN', `You do not have permission to update: ${forbidden.join(', ')}`, 403)
    }

    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', employee_id)
      .select('id, employee_code, first_name, last_name, email')
      .single()

    if (error) {
      console.error('Employee update error:', error)
      return err('INTERNAL_ERROR', `Failed to update employee: ${error.message}`, 500)
    }

    return ok(data)
  } catch (e) {
    return handleError(e)
  }
})
