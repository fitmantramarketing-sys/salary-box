import { getServiceClient } from './supabase.ts'
import { sendPushNotification } from './push.ts'

export async function createNotification({
  recipientId,
  title,
  body,
  type,
  referenceId,
  referenceTable,
}: {
  recipientId: string
  title: string
  body: string
  type: string
  referenceId?: string
  referenceTable?: string
}): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase.from('notifications').insert({
    recipient_id: recipientId,
    title,
    body,
    type,
    reference_id: referenceId ?? null,
    reference_table: referenceTable ?? null,
  })
  if (error) console.error('Failed to create notification:', error)

  // Fire-and-forget push notification
  sendPushNotification({ recipientId, title, body })
}
