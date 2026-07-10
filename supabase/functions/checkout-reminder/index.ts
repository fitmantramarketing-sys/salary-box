import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { resolveShift, getEffectiveTimes } from '../_shared/shift.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function getISTNow(): { date: string; minutes: number; timeStr: string } {
  const now = new Date()
  const ist = new Date(now.getTime() + IST_OFFSET_MS)
  const y = ist.getUTCFullYear()
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0')
  const d = String(ist.getUTCDate()).padStart(2, '0')
  const h = ist.getUTCHours()
  const min = ist.getUTCMinutes()
  return {
    date: `${y}-${m}-${d}`,
    minutes: h * 60 + min,
    timeStr: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const supabase = getServiceClient()
    const { date: today, minutes: nowIST } = getISTNow()

    // Fetch unchecked-out records for today
    const { data: rawRecords } = await supabase
      .from('attendance_records')
      .select(`
        id,
        employee_id,
        check_in_time,
        checkout_reminder_sent_at,
        employees!inner(email, first_name, role)
      `)
      .eq('date', today)
      .not('check_in_time', 'is', null)
      .is('check_out_time', null)
      .neq('employees.role', 'owner')

    // In-memory dedup: skip records that already got a reminder in the last 24h
    const now = Date.now()
    const records = (rawRecords || []).filter((r) => {
      if (!r.checkout_reminder_sent_at) return true
      return now - new Date(r.checkout_reminder_sent_at).getTime() > 86400000
    })

    if (records.length === 0) {
      return ok({ processed: 0 })
    }

    let processed = 0

    for (const record of records) {
      try {
        // Skip night shifts in v1
        const shift = await resolveShift(record.employee_id, today)
        if (shift.is_night_shift) continue

        const effective = getEffectiveTimes(shift, today)
        const [eh, em] = effective.end_time.split(':').map(Number)
        const endMinutes = eh * 60 + em
        const diff = endMinutes - nowIST

        // Only send when shift ends within the next 15 minutes
        if (diff < 0 || diff > 15) continue

        const empData = record.employees as unknown as { email: string; first_name: string }
        const message = `Your shift is about to end in 15 minutes (${effective.end_time} IST). Don't forget to checkout!`

        await createNotification({
          recipientId: record.employee_id,
          title: 'Shift Ending Soon',
          body: message,
          type: 'checkout_reminder',
          referenceId: record.id,
          referenceTable: 'attendance_records',
        })

        try {
          await sendEmail({
            to: empData.email,
            subject: 'Shift Ending Soon \u2014 Don\u2019t Forget to Check Out!',
            html: `
              <h2>Shift Ending Soon</h2>
              <p>Hi ${empData.first_name},</p>
              <p>Your shift is about to end in <strong>15 minutes</strong> (${effective.end_time} IST).</p>
              <p>Please <strong>check out</strong> before leaving.</p>
              <hr />
              <p style="color: #666; font-size: 12px;">This is an automated reminder from the HR system.</p>
            `.trim(),
          })
        } catch (emailErr) {
          console.error(`Checkout reminder email failed for ${record.employee_id}:`, emailErr)
        }

        await supabase
          .from('attendance_records')
          .update({ checkout_reminder_sent_at: new Date().toISOString() })
          .eq('id', record.id)

        processed++
      } catch (err) {
        console.error(`Failed to process checkout reminder for ${record.employee_id}:`, err)
        continue
      }
    }

    return ok({ processed })
  } catch (e) {
    return handleError(e)
  }
})
