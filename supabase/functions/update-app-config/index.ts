import { getActor, assertRole } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { ok, err, cors, handleError } from '../_shared/response.ts'

const CONFIG_TYPES: Record<string, 'integer' | 'boolean' | 'time'> = {
  regularization_window_days: 'integer',
  leave_sla_business_days: 'integer',
  optional_holiday_limit_per_year: 'integer',
  auto_checkout_time: 'time',
  rehire_carry_leave_balance: 'boolean',
}

const TIME_REGEX = /^\d{2}:\d{2}:\d{2}$/

function validateValue(key: string, value: string): string | null {
  const type = CONFIG_TYPES[key]
  if (!type) return 'Unknown config key'

  if (type === 'integer') {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0 || String(num) !== value.trim()) {
      return 'Value must be a positive integer'
    }
  }

  if (type === 'boolean') {
    if (value !== 'true' && value !== 'false') {
      return 'Value must be "true" or "false"'
    }
  }

  if (type === 'time') {
    if (!TIME_REGEX.test(value.trim())) {
      return 'Value must be a time in HH:MM:SS format'
    }
  }

  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner'])

    const { key, value } = await req.json()

    if (!key || value === undefined || value === null) {
      return err('VALIDATION_ERROR', 'key and value are required')
    }

    if (typeof key !== 'string' || typeof value !== 'string') {
      return err('VALIDATION_ERROR', 'key and value must be strings')
    }

    const validationError = validateValue(key, value)
    if (validationError) {
      return err('VALIDATION_ERROR', validationError)
    }

    const trimmed = value.trim()
    const supabase = getServiceClient()

    const { error: upsertError } = await supabase
      .from('app_config')
      .upsert({ key, value: trimmed, updated_by: actor.actorId })

    if (upsertError) {
      console.error('upsert error:', upsertError.message)
      return err('INTERNAL_ERROR', 'Failed to update configuration')
    }

    return ok({ key, value: trimmed })
  } catch (e) {
    console.error('top-level error:', (e as Record<string, unknown>)?.message ?? String(e))
    return handleError(e)
  }
})
