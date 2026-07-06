import { callEdgeFunction } from '@/lib/edge'

const VAPID_PUBLIC_KEY = 'BC8AgPbUUGn_MopfD0e7Oisa1koqXGjOdzN_tJ62RdCNp0JCFrcHlmfZondzHROFDXihKGe08RTIlgyfrgngr0g'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export async function registerPushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()

    if (existing) {
      // Re-subscribe if the VAPID key changed (clear old, subscribe new)
      const subscribedVapid = existing.options.applicationServerKey
      const currentVapid = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      if (subscribedVapid && arraysEqual(new Uint8Array(subscribedVapid), currentVapid)) {
        return
      }
      await existing.unsubscribe()
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    await callEdgeFunction('subscribe-push', subscription.toJSON())
  } catch (e) {
    // Permission denied or push unavailable — silently ignore
    console.warn('Push subscription failed:', e)
  }
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}
