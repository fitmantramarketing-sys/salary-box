import { getActor } from '../_shared/auth.ts'
import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    const { endpoint } = await req.json()

    if (!endpoint) {
      throw {
        code: 'VALIDATION_ERROR',
        message: 'endpoint is required.',
        status: 400,
      }
    }

    const supabase = getServiceClient()

    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('employee_id', actor.actorId)
      .eq('endpoint', endpoint)

    return ok({ success: true })
  } catch (e) {
    return handleError(e)
  }
})
