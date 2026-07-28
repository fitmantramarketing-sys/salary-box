import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function cors(): Response {
  return new Response(null, { headers: CORS_HEADERS })
}

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function err(code: string, message: string, status = 400, details?: unknown): Response {
  return new Response(
    JSON.stringify({ error: { code, message, ...(details !== undefined ? { details } : {}) } }),
    { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  )
}

function handleError(e: unknown): Response {
  if (e && typeof e === 'object' && 'code' in e) {
    const error = e as { code: string; message: string; status?: number }
    return err(error.code, error.message, error.status ?? 400)
  }
  console.error('Unexpected error:', e)
  return err('INTERNAL_ERROR', 'An unexpected error occurred', 500)
}

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return err('UNAUTHORIZED', 'Missing or invalid authorization header', 401)
    }
    const token = authHeader.slice(7)
    const supabase = getServiceClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return err('UNAUTHORIZED', 'Invalid or expired token', 401)
    }

    const { data: actor, error: empError } = await supabase
      .from('employees')
      .select('id, role')
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .single()

    if (empError || !actor) {
      return err('UNAUTHORIZED', 'Employee record not found or inactive', 401)
    }

    if (actor.role !== 'owner') {
      return err('FORBIDDEN', 'Only owners can deactivate employees', 403)
    }

    const { employee_id, reason } = await req.json()
    if (!employee_id) {
      return err('VALIDATION_ERROR', 'employee_id is required', 400)
    }

    const { data: employee, error: fetchError } = await supabase
      .from('employees')
      .select('id, auth_id, is_active')
      .eq('id', employee_id)
      .single()

    if (fetchError || !employee) {
      return err('NOT_FOUND', 'Employee not found', 404)
    }

    if (!employee.is_active) {
      return err('CONFLICT', 'Employee is already deactivated', 409)
    }

    const { data: orphanedReports } = await supabase
      .from('employees')
      .select('id, first_name, last_name, employee_code')
      .eq('reporting_manager_id', employee_id)
      .eq('is_active', true)

    if (orphanedReports && orphanedReports.length > 0) {
      return err('CONFLICT', `${orphanedReports.length} employee(s) still report to this person. Reassign before deactivating.`, 409, {
        affected_employees: orphanedReports,
      })
    }

    const today = new Date().toISOString().split('T')[0]

    const { error: updateError } = await supabase
      .from('employees')
      .update({ is_active: false, exit_date: today })
      .eq('id', employee_id)

    if (updateError) {
      console.error('Deactivation update error:', updateError)
      return err('INTERNAL_ERROR', 'Failed to deactivate employee', 500)
    }

    const { error: eventError } = await supabase
      .from('employee_lifecycle_events')
      .insert({
        employee_id,
        event_type: 'deactivation',
        effective_date: today,
        reason: reason || null,
        performed_by: actor.id,
      })

    if (eventError) {
      console.error('Lifecycle event insert error:', eventError)
    }

    return ok({ deactivated: true }, 200)
  } catch (e) {
    return handleError(e)
  }
})
