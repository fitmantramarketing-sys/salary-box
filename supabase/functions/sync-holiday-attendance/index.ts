import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { isHoliday } from '../_shared/holiday.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr'])

    const { date } = await req.json()
    if (!date) {
      throw { code: 'VALIDATION_ERROR', message: 'date is required', status: 400 }
    }

    const supabase = getServiceClient()

    const { data: records } = await supabase
      .from('attendance_records')
      .select('id, employee_id, status')
      .eq('date', date)

    if (!records || records.length === 0) {
      return ok({ updated: 0, date })
    }

    let updated = 0
    for (const record of records) {
      const holidayFlag = await isHoliday(record.employee_id, date)

      if (holidayFlag && (!record.status || record.status === 'absent' || record.status === 'incomplete')) {
        const { error } = await supabase
          .from('attendance_records')
          .update({
            status: 'holiday',
            total_hours: null,
            overtime_hours: null,
            is_late: false,
          })
          .eq('id', record.id)
        if (!error) updated++
      } else if (!holidayFlag && record.status === 'holiday') {
        const { error } = await supabase
          .from('attendance_records')
          .update({ status: 'incomplete' })
          .eq('id', record.id)
        if (!error) updated++
      }
    }

    return ok({ updated, date })
  } catch (e) {
    return handleError(e)
  }
})
