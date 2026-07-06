import { getActor } from '../_shared/auth.ts'
import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    const { endpoint, keys } = await req.json()

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw {
        code: 'VALIDATION_ERROR',
        message: 'endpoint, keys.p256dh, and keys.auth are required.',
        status: 400,
      }
    }

    const supabase = getServiceClient()

    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('employee_id', actor.actorId)
      .eq('endpoint', endpoint)
      .maybeSingle()

    if (existing) {
      return ok({ id: existing.id })
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .insert({
        employee_id: actor.actorId,
        endpoint,
        p256dh_key: keys.p256dh,
        auth_key: keys.auth,
      })
      .select('id')
      .single()

    if (error) throw { code: 'DB_ERROR', message: error.message, status: 500 }

    return ok({ id: data.id }, 201)
  } catch (e) {
    return handleError(e)
  }
})
