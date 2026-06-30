import type { ShiftInfo } from './shift.ts'

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
    const capTime = new Date(checkIn)
    const [ch, cm] = capAt.split(':').map(Number)
    capTime.setHours(ch, cm, 0, 0)
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
  const checkIn = new Date(checkInTime)
  const startToday = new Date(checkInTime)
  const [sh, sm] = shiftStart.split(':').map(Number)
  startToday.setHours(sh, sm, 0, 0)
  const graceMs = gracePeriodMinutes * 60 * 1000
  return checkIn.getTime() > startToday.getTime() + graceMs
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

function isCheckInAfterHalfDayCutoff(checkInTime: string, shiftStart: string, gracePeriodMinutes: number): boolean {
  const checkIn = new Date(checkInTime)
  const cutoff = new Date(checkInTime)
  const [sh, sm] = shiftStart.split(':').map(Number)
  cutoff.setHours(sh, sm + gracePeriodMinutes, 0, 0)
  return checkIn.getTime() > cutoff.getTime()
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

  if (!record.check_in_time) {
    return { status: 'absent', total_hours: null, is_late: false }
  }

  if (!record.check_out_time) {
    return { status: 'absent', total_hours: null, is_late: false }
  }

  const totalHours = computeTotalHours(
    record.check_in_time,
    record.check_out_time,
    shift.break_minutes,
    shift.is_night_shift,
    shift.end_time
  )

  if (isCheckInAfterHalfDayCutoff(record.check_in_time, shift.start_time, shift.grace_period_minutes)) {
    return { status: 'half_day', total_hours: totalHours, is_late: record.is_late }
  }

  if (record.is_wfh) {
    return { status: 'work_from_home', total_hours: totalHours, is_late: record.is_late }
  }

  return { status: 'present', total_hours: totalHours, is_late: record.is_late }
}

export function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h + m / 60
}
