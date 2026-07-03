import { getEffectiveTimes, type ShiftInfo } from './shift.ts'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

export function getISTMinutes(utcIso: string): number {
  const d = new Date(utcIso)
  const ist = new Date(d.getTime() + IST_OFFSET_MS)
  return ist.getUTCHours() * 60 + ist.getUTCMinutes()
}

export function computeTotalHours(
  checkIn: string,
  checkOut: string,
  breakMinutes: number,
  isNightShift: boolean,
  capAt: string | null = null
): number {
  const inTime = new Date(checkIn).getTime()
  let outTime = new Date(checkOut).getTime()

  if (capAt) {
    const checkInDate = new Date(checkIn)
    const checkInIST = new Date(checkInDate.getTime() + IST_OFFSET_MS)
    const [ch, cm] = capAt.split(':').map(Number)
    checkInIST.setUTCHours(ch, cm, 0, 0)
    const capTime = new Date(checkInIST.getTime() - IST_OFFSET_MS)
    if (outTime > capTime.getTime()) {
      outTime = capTime.getTime()
    }
  }

  if (isNightShift && outTime < inTime) {
    outTime += 24 * 60 * 60 * 1000
  }

  const diffMs = outTime - inTime
  const diffHours = diffMs / (1000 * 60 * 60)
  const hours = Math.max(0, diffHours - breakMinutes / 60)
  return Math.round(hours * 100) / 100
}

export function computeIsLate(
  checkInTime: string,
  shiftStart: string,
  gracePeriodMinutes: number
): boolean {
  const checkInMinutes = getISTMinutes(checkInTime)
  const [sh, sm] = shiftStart.split(':').map(Number)
  const shiftStartMinutes = sh * 60 + sm
  return checkInMinutes > shiftStartMinutes + gracePeriodMinutes
}

export type AttendanceRecordForCompute = {
  id?: string
  employee_id: string
  date: string
  shift_id?: string | null
  check_in_time?: string | null
  check_out_time?: string | null
  is_wfh: boolean
  status: string
  total_hours?: number | null
  is_late: boolean
  is_manually_entered: boolean
}

export function computeStatus(
  record: AttendanceRecordForCompute,
  shift: ShiftInfo,
  holidayFlag: boolean,
  weeklyOffFlag: boolean
): {
  status: string
  total_hours: number | null
  is_late: boolean
} {
  if (record.status === 'on_leave') {
    return { status: 'on_leave', total_hours: record.total_hours, is_late: record.is_late }
  }

  if (holidayFlag) {
    return { status: 'holiday', total_hours: null, is_late: false }
  }

  if (weeklyOffFlag) {
    return { status: 'weekly_off', total_hours: null, is_late: false }
  }

  if (record.is_wfh && !record.check_in_time) {
    return { status: 'work_from_home', total_hours: null, is_late: false }
  }

  // No check-in → absent
  if (!record.check_in_time) {
    return { status: 'absent', total_hours: null, is_late: false }
  }

  // Resolve effective start/end for the day (Saturday may differ)
  const effective = getEffectiveTimes(shift, record.date)
  const effectiveStart = effective.start_time
  const effectiveEnd = effective.end_time

  // Minutes past shift start (negative = before shift)
  const checkInMinutes = getISTMinutes(record.check_in_time)
  const [sh, sm] = effectiveStart.split(':').map(Number)
  const shiftStartMinutes = sh * 60 + sm
  const diffMin = checkInMinutes - shiftStartMinutes

  const isLate = checkInMinutes > shiftStartMinutes

  // Compute total_hours if check-out exists
  let totalHours: number | null = null
  if (record.check_out_time) {
    totalHours = computeTotalHours(
      record.check_in_time,
      record.check_out_time,
      shift.break_minutes,
      shift.is_night_shift,
      effectiveEnd
    )
  }

  // Rules:
  //   Before shift start  → present
  //   0–5 min after start → present (no late mark)
  //   5–20 min after      → half_day + late
  //   >20 min after       → absent + late

  if (diffMin <= 0) {
    const s = record.is_wfh ? 'work_from_home' : 'present'
    return { status: s, total_hours: totalHours, is_late: false }
  }

  if (diffMin <= 5) {
    const s = record.is_wfh ? 'work_from_home' : 'present'
    return { status: s, total_hours: totalHours, is_late: false }
  }

  if (diffMin <= 20) {
    return { status: 'half_day', total_hours: totalHours, is_late: true }
  }

  return { status: 'absent', total_hours: totalHours, is_late: true }
}

export function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h + m / 60
}
