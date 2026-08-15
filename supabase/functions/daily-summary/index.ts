import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { sendEmail } from '../_shared/email.ts'
import { getEffectiveTimes, resolveShift } from '../_shared/shift.ts'
import { getISTMinutes } from '../_shared/attendance.ts'

const STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  half_day: 'Half Day',
  work_from_home: 'WFH',
  absent: 'Absent',
  on_leave: 'On Leave',
  incomplete: 'Incomplete',
  holiday: 'Holiday',
  weekly_off: 'Weekly Off',
  shift_yet_to_start: 'Shift Yet to Start',
}

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return 'N/A'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
}

function fmtHours(h: number | null | undefined): string {
  if (h == null) return 'N/A'
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  if (mm === 60) return `${hh + 1}h`
  return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`
}

function fmtClock(clock: string | null | undefined): string {
  if (!clock) return 'N/A'
  const [hStr, mStr] = clock.split(':')
  const h = Number(hStr)
  const m = mStr ? Number(mStr) : 0
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

function clockToMinutes(clock: string): number {
  const [hStr, mStr] = clock.split(':')
  return Number(hStr) * 60 + (mStr ? Number(mStr) : 0)
}

// Cron: daily at 20:00 IST (14:30 UTC) - sends today's full summary to the owner
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const supabase = getServiceClient()

    let overrideTo: string | null = null
    try {
      const body = await req.json()
      overrideTo = typeof body?.to === 'string' && body.to.trim() ? body.to.trim() : null
    } catch {
      // No body -> cron invocation
    }

    const { data: owner } = await supabase
      .from('employees')
      .select('id, email, first_name, last_name')
      .eq('role', 'owner')
      .eq('is_active', true)
      .maybeSingle()

    if (!owner?.email) {
      return ok({ processed: 0, message: 'No active owner with email found' })
    }

    const today = new Date().toISOString().slice(0, 10)

    const [empRes, attRes, holRes, shiftRes, leaveRes, regRes, earlyRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code, department:departments!department_id(name)')
        .eq('is_active', true)
        .neq('role', 'owner')
        .order('first_name'),
      supabase
        .from('attendance_records')
        .select('*')
        .eq('date', today),
      supabase
        .from('holidays')
        .select('date')
        .eq('date', today),
      supabase
        .from('shifts')
        .select('weekly_off_days')
        .eq('is_default', true)
        .limit(1),
      supabase
        .from('leave_applications')
        .select('*, employee:employees!employee_id(first_name, last_name, employee_code), leave_type:leave_types!leave_type_id(name)')
        .eq('status', 'pending')
        .order('applied_at'),
      supabase
        .from('attendance_regularization_requests')
        .select('*, employee:employees!employee_id(first_name, last_name, employee_code), attendance_record:attendance_record_id(date)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('attendance_records')
        .select('id, employee_id, date, early_checkout_reason, employee:employees!employee_id(first_name, last_name, employee_code)')
        .eq('early_checkout_status', 'pending')
        .not('early_checkout_reason', 'is', null)
        .order('date', { ascending: false }),
    ])

    if (empRes.error) throw empRes.error
    if (attRes.error) throw attRes.error
    if (holRes.error) throw holRes.error
    if (leaveRes.error) throw leaveRes.error
    if (regRes.error) throw regRes.error
    if (earlyRes.error) throw earlyRes.error

    const employees = empRes.data ?? []
    const records = attRes.data ?? []
    const isHoliday = (holRes.data ?? []).length > 0
    const weeklyOffDays = new Set<number>((shiftRes.data?.[0]?.weekly_off_days as number[] | undefined) ?? [0])
    const dayOfWeek = new Date(today).getDay()
    const isWeeklyOff = !isHoliday && weeklyOffDays.has(dayOfWeek)

    const recordMap = new Map<string, (typeof records)[0]>()
    for (const r of records) {
      recordMap.set(r.employee_id, r)
    }

    const shiftStarts = await Promise.all(
      employees.map(async (emp) => {
        try {
          const shift = await resolveShift(emp.id, today)
          return { employeeId: emp.id, start: getEffectiveTimes(shift, today).start_time }
        } catch {
          return { employeeId: emp.id, start: null }
        }
      })
    )
    const shiftStartMap = new Map<string, string | null>(shiftStarts.map((s) => [s.employeeId, s.start]))
    const nowMinutes = getISTMinutes(new Date().toISOString())

    const rows = employees.map((emp) => {
      const dept = emp.department as { name: string } | null
      const rec = recordMap.get(emp.id)
      const shiftStart = shiftStartMap.get(emp.id) ?? null
      let status = rec?.status ?? 'absent'
      if (!rec) {
        if (isHoliday) status = 'holiday'
        else if (isWeeklyOff) status = 'weekly_off'
        else if (shiftStart && nowMinutes < clockToMinutes(shiftStart)) status = 'shift_yet_to_start'
        else status = 'absent'
      }
      return {
        name: `${emp.first_name} ${emp.last_name}`,
        code: emp.employee_code,
        department: dept?.name ?? '-',
        shiftStart,
        status,
        checkIn: rec?.check_in_time ?? null,
        checkOut: rec?.check_out_time ?? null,
        hours: rec?.total_hours ?? null,
        isLate: rec?.is_late ?? false,
      }
    })

    const count = (s: string) => rows.filter((r) => r.status === s).length
    const counts = {
      present: count('present'),
      late: count('late'),
      halfDay: count('half_day'),
      wfh: count('work_from_home'),
      absent: count('absent'),
      onLeave: count('on_leave'),
      incomplete: count('incomplete'),
    }
    const expected = employees.length
    const presentLike = counts.present + counts.late + counts.halfDay + counts.wfh

    const attendanceTable = rows
      .map(
        (r) => `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 8px; font-size: 13px;">${esc(r.name)}</td>
            <td style="padding: 6px 8px; font-size: 12px; color: #666;">${esc(r.code)}</td>
            <td style="padding: 6px 8px; font-size: 13px;">${esc(r.department)}</td>
            <td style="padding: 6px 8px; font-size: 12px; font-family: monospace;">${fmtClock(r.shiftStart)}</td>
            <td style="padding: 6px 8px; font-size: 13px;">${esc(STATUS_LABELS[r.status] ?? r.status)}</td>
            <td style="padding: 6px 8px; font-size: 12px; font-family: monospace;">${fmtTime(r.checkIn)}</td>
            <td style="padding: 6px 8px; font-size: 12px; font-family: monospace;">${fmtTime(r.checkOut)}</td>
            <td style="padding: 6px 8px; font-size: 13px; text-align: right;">${fmtHours(r.hours)}</td>
            <td style="padding: 6px 8px; font-size: 13px; text-align: center;">${r.isLate ? 'Yes' : 'N/A'}</td>
          </tr>`
      )
      .join('')

    const pendingSections: string[] = []

    const leaveApps = leaveRes.data ?? []
    if (leaveApps.length > 0) {
      const items = leaveApps
        .map((a) => {
          const emp = a.employee as { first_name?: string; last_name?: string; employee_code?: string } | null
          const lt = a.leave_type as { name?: string } | null
          return `<li style="font-size: 13px; margin-bottom: 4px;"><strong>${esc(emp?.first_name ?? '')} ${esc(emp?.last_name ?? '')}</strong> (${esc(emp?.employee_code ?? '')}) - ${esc(lt?.name ?? '')} - ${esc(a.from_date)} to ${esc(a.to_date)}</li>`
        })
        .join('')
      pendingSections.push(`<h3 style="font-size: 14px; margin: 20px 0 8px; color: #b45309;">Pending Leave Applications (${leaveApps.length})</h3><ul style="margin: 0; padding-left: 20px;">${items}</ul>`)
    }

    const regRequests = regRes.data ?? []
    if (regRequests.length > 0) {
      const items = regRequests
        .map((r) => {
          const emp = r.employee as { first_name?: string; last_name?: string; employee_code?: string } | null
          const att = r.attendance_record as { date?: string } | null
          return `<li style="font-size: 13px; margin-bottom: 4px;"><strong>${esc(emp?.first_name ?? '')} ${esc(emp?.last_name ?? '')}</strong> (${esc(emp?.employee_code ?? '')}) - ${esc(att?.date ?? '')} - requested: ${esc(r.requested_status)}</li>`
        })
        .join('')
      pendingSections.push(`<h3 style="font-size: 14px; margin: 20px 0 8px; color: #b45309;">Pending Regularization Requests (${regRequests.length})</h3><ul style="margin: 0; padding-left: 20px;">${items}</ul>`)
    }

    const earlyCheckouts = earlyRes.data ?? []
    if (earlyCheckouts.length > 0) {
      const items = earlyCheckouts
        .map((r) => {
          const emp = r.employee as { first_name?: string; last_name?: string; employee_code?: string } | null
          return `<li style="font-size: 13px; margin-bottom: 4px;"><strong>${esc(emp?.first_name ?? '')} ${esc(emp?.last_name ?? '')}</strong> (${esc(emp?.employee_code ?? '')}) - ${esc(r.date)}</li>`
        })
        .join('')
      pendingSections.push(`<h3 style="font-size: 14px; margin: 20px 0 8px; color: #b45309;">Pending Early Checkouts (${earlyCheckouts.length})</h3><ul style="margin: 0; padding-left: 20px;">${items}</ul>`)
    }

    const pendingHtml = pendingSections.length > 0 ? pendingSections.join('') : '<p style="font-size: 13px; color: #666;">No pending approvals.</p>'

    const dayLabel = isHoliday ? ' (Holiday)' : isWeeklyOff ? ' (Weekly Off)' : ''

    await sendEmail({
      to: overrideTo ?? owner.email,
      subject: `Daily Attendance Summary - ${today}`,
      html: `
        <h2 style="margin: 0 0 4px;">Daily Attendance Summary</h2>
        <p style="margin: 0 0 16px; color: #666; font-size: 13px;">${today}${dayLabel}</p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="padding: 8px; text-align: center; background: #f0fdf4; border: 1px solid #e2e2e2; border-radius: 6px; width: 12.5%;">
              <div style="font-size: 20px; font-weight: 700; color: #16a34a;">${counts.present}</div>
              <div style="font-size: 11px; color: #666;">Present</div>
            </td>
            <td style="padding: 8px; text-align: center; background: #f0fdf4; border: 1px solid #e2e2e2; border-radius: 6px; width: 12.5%;">
              <div style="font-size: 20px; font-weight: 700; color: #16a34a;">${counts.late}</div>
              <div style="font-size: 11px; color: #666;">Late</div>
            </td>
            <td style="padding: 8px; text-align: center; background: #eff6ff; border: 1px solid #e2e2e2; border-radius: 6px; width: 12.5%;">
              <div style="font-size: 20px; font-weight: 700; color: #2563eb;">${counts.wfh}</div>
              <div style="font-size: 11px; color: #666;">WFH</div>
            </td>
            <td style="padding: 8px; text-align: center; background: #fff7ed; border: 1px solid #e2e2e2; border-radius: 6px; width: 12.5%;">
              <div style="font-size: 20px; font-weight: 700; color: #ea580c;">${counts.halfDay}</div>
              <div style="font-size: 11px; color: #666;">Half Day</div>
            </td>
            <td style="padding: 8px; text-align: center; background: #fef2f2; border: 1px solid #e2e2e2; border-radius: 6px; width: 12.5%;">
              <div style="font-size: 20px; font-weight: 700; color: #dc2626;">${counts.absent}</div>
              <div style="font-size: 11px; color: #666;">Absent</div>
            </td>
            <td style="padding: 8px; text-align: center; background: #faf5ff; border: 1px solid #e2e2e2; border-radius: 6px; width: 12.5%;">
              <div style="font-size: 20px; font-weight: 700; color: #9333ea;">${counts.onLeave}</div>
              <div style="font-size: 11px; color: #666;">On Leave</div>
            </td>
            <td style="padding: 8px; text-align: center; background: #fefce8; border: 1px solid #e2e2e2; border-radius: 6px; width: 12.5%;">
              <div style="font-size: 20px; font-weight: 700; color: #ca8a04;">${counts.incomplete}</div>
              <div style="font-size: 11px; color: #666;">Incomplete</div>
            </td>
            <td style="padding: 8px; text-align: center; background: #f8fafc; border: 1px solid #e2e2e2; border-radius: 6px; width: 12.5%;">
              <div style="font-size: 20px; font-weight: 700; color: #475569;">${presentLike}/${expected}</div>
              <div style="font-size: 11px; color: #666;">Present Like</div>
            </td>
          </tr>
        </table>

        <h3 style="font-size: 14px; margin: 0 0 8px;">Attendance Detail (${expected} employees)</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e2e2;">
          <thead>
            <tr style="background: #f8fafc; text-align: left;">
              <th style="padding: 6px 8px; font-size: 12px;">Employee</th>
              <th style="padding: 6px 8px; font-size: 12px;">Code</th>
              <th style="padding: 6px 8px; font-size: 12px;">Department</th>
              <th style="padding: 6px 8px; font-size: 12px;">Shift Start</th>
              <th style="padding: 6px 8px; font-size: 12px;">Status</th>
              <th style="padding: 6px 8px; font-size: 12px;">Check In</th>
              <th style="padding: 6px 8px; font-size: 12px;">Check Out</th>
              <th style="padding: 6px 8px; font-size: 12px; text-align: right;">Hours</th>
              <th style="padding: 6px 8px; font-size: 12px; text-align: center;">Late</th>
            </tr>
          </thead>
          <tbody>${attendanceTable}</tbody>
        </table>

        <h2 style="font-size: 16px; margin: 24px 0 0;">Pending Approvals</h2>
        ${pendingHtml}

        <hr style="border: none; border-top: 1px solid #e2e2e2; margin: 24px 0 12px;" />
        <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
      `,
    })

    return ok({ processed: 1, date: today, owner: owner.email, to: overrideTo ?? owner.email })
  } catch (e) {
    return handleError(e)
  }
})
