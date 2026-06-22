import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError, err } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr', 'employee'])

    const { holiday_id } = await req.json()

    if (!holiday_id) {
      return err('VALIDATION_ERROR', 'holiday_id is required')
    }

    const supabase = getServiceClient()

    const { data: holiday, error: holErr } = await supabase
      .from('holidays')
      .select('*')
      .eq('id', holiday_id)
      .single()

    if (holErr || !holiday) {
      return err('NOT_FOUND', 'Holiday not found')
    }

    if (!holiday.is_optional) {
      return err('VALIDATION_ERROR', 'This holiday is not optional')
    }

    if (holiday.date <= new Date().toISOString().split('T')[0]) {
      return err('VALIDATION_ERROR', 'Cannot opt in to a past holiday')
    }

    const year = holiday.date.substring(0, 4)

    const { data: config } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'optional_holiday_limit_per_year')
      .maybeSingle()

    const limit = config ? parseInt(config.value) : 2

    const { data: myOptIns } = await supabase
      .from('employee_optional_holidays')
      .select('holiday_id')
      .eq('employee_id', actor.actorId)

    if (myOptIns && myOptIns.length > 0) {
      const optInIds = myOptIns.map(o => o.holiday_id)
      const { data: optedHolidays } = await supabase
        .from('holidays')
        .select('date')
        .in('id', optInIds)
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)

      if (optedHolidays && optedHolidays.length >= limit) {
        return err('FORBIDDEN', `Maximum optional holiday opt-ins per year is ${limit}`)
      }
    }

    const { error: insErr } = await supabase
      .from('employee_optional_holidays')
      .insert({
        employee_id: actor.actorId,
        holiday_id,
        year,
      })

    if (insErr) {
      if (insErr.code === '23505') {
        return err('DUPLICATE', 'Already opted in to this holiday')
      }
      throw insErr
    }

    return ok({ holiday_id, opted_in: true }, 201)
  } catch (e) {
    return handleError(e)
  }
})
