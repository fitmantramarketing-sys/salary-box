import { callEdgeFunction } from '@/lib/edge'
import type { AttendanceStatus } from './types'

export async function checkNetwork(): Promise<boolean> {
  try {
    const result = await callEdgeFunction<Record<string, never>, { whitelisted: boolean }>('check-network', {})
    return result.whitelisted
  } catch {
    return false
  }
}

export function getCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        const messages: Record<number, string> = {
          [err.PERMISSION_DENIED]: 'Location access denied. Please enable GPS in your browser settings.',
          [err.POSITION_UNAVAILABLE]: 'Location unavailable. Please move to an open area and try again.',
          [err.TIMEOUT]: 'Location request timed out. Please try again.',
        }
        reject(new Error(messages[err.code] ?? 'Failed to get location.'))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  })
}

export function getAttendanceStatusLabel(status: AttendanceStatus): string {
  const labels: Record<NonNullable<AttendanceStatus>, string> = {
    present: 'Present',
    absent: 'Absent',
    half_day: 'Half Day',
    on_leave: 'On Leave',
    holiday: 'Holiday',
    work_from_home: 'WFH',
    weekly_off: 'Weekly Off',
    incomplete: 'Incomplete',
  }
  return status ? (labels[status] ?? status) : '—'
}

export function formatHours(hours: number | null): string {
  if (hours === null) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
