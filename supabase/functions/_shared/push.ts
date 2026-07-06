import { getServiceClient } from './supabase.ts'
import webpush from 'npm:web-push'

const VAPID_SUBJECT = 'mailto:noreply@hr.fitmantra.co.in'

export async function sendPushNotification({
  recipientId,
  title,
  body,
}: {
  recipientId: string
  title: string
  body: string
}): Promise<void> {
  const supabase = getServiceClient()

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key')
    .eq('employee_id', recipientId)

  if (error) {
    console.error('Failed to fetch push subscriptions:', error.message)
    return
  }

  if (!subscriptions?.length) return

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('VAPID keys not configured')
    return
  }

  webpush.setVapidDetails(VAPID_SUBJECT, vapidPublicKey, vapidPrivateKey)

  const payload = JSON.stringify({ title, body })

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
        },
        payload,
        { TTL: 86400 }
      )
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'statusCode' in e && (e as { statusCode: number }).statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        console.log('Removed expired push subscription:', sub.id)
      } else {
        console.error('Failed to send push to subscription:', sub.id, e)
      }
    }
  }
}
