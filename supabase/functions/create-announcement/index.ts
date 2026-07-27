import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, cors, handleError, err } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { createNotification } from '../_shared/notify.ts'
import { sendEmail } from '../_shared/email.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr'])

    const { title, body } = await req.json()

    if (!title?.trim() || !body?.trim()) {
      return err('VALIDATION_ERROR', 'title and body are required')
    }

    const supabase = getServiceClient()

    const { data: announcement, error: insertErr } = await supabase
      .from('announcements')
      .insert({
        title: title.trim(),
        body: body.trim(),
        created_by: actor.actorId,
      })
      .select('id, title, body, created_at')
      .single()

    if (insertErr) {
      return err('INTERNAL_ERROR', 'Failed to create announcement')
    }

    const { data: employees } = await supabase
      .from('employees')
      .select('id, personal_email')
      .neq('role', 'system_admin')
      .eq('is_active', true)

    if (employees) {
      for (const emp of employees) {
        if (emp.id === actor.actorId) continue

        await createNotification({
          recipientId: emp.id,
          title: 'New Announcement',
          body: `${title.trim()} — ${body.trim().substring(0, 100)}${body.trim().length > 100 ? '…' : ''}`,
          type: 'announcement',
          referenceId: announcement!.id,
          referenceTable: 'announcements',
        })

        if (emp.personal_email) {
          try {
            await sendEmail({
              to: emp.personal_email,
              subject: `Announcement: ${title.trim()}`,
              html: `
                <h2>${title.trim()}</h2>
                <p>${body.trim()}</p>
                <hr />
                <p style="color: #666; font-size: 12px;">This announcement was posted by ${actor.actorName}. Replies to this email are not monitored.</p>
              `,
            })
          } catch (emailErr) {
            console.error(`Announcement email failed for ${emp.id}:`, emailErr)
          }
        }
      }
    }

    return ok(announcement, 201)
  } catch (e) {
    return handleError(e)
  }
})
