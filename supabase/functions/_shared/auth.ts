import { getServiceClient } from './supabase.ts'

export type Role = 'owner' | 'hr' | 'employee' | 'system_admin'

export type Actor = {
  actorId: string
  actorRole: Role
  authUid: string
  actorName: string
}

export async function getActor(req: Request): Promise<Actor> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header', status: 401 }
  }

  const token = authHeader.slice(7)
  const supabase = getServiceClient()

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    throw { code: 'UNAUTHORIZED', message: 'Invalid or expired token', status: 401 }
  }

  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, role, first_name, last_name')
    .eq('auth_id', user.id)
    .eq('is_active', true)
    .single()

  if (empError || !employee) {
    throw { code: 'UNAUTHORIZED', message: 'Employee record not found or inactive', status: 401 }
  }

  return {
    actorId: employee.id as string,
    actorRole: employee.role as Role,
    authUid: user.id,
    actorName: `${employee.first_name} ${employee.last_name}`,
  }
}

export function assertRole(actor: Actor, allowed: Role[]): void {
  if (!allowed.includes(actor.actorRole)) {
    throw { code: 'FORBIDDEN', message: 'Insufficient role for this action', status: 403 }
  }
}
