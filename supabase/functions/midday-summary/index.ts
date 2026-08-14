import { ok, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { sendEmail } from '../_shared/email.ts'

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

// Cron: daily at 10:30 IST (05:00 UTC) - sends today's check-in, WFH, late status to the owner
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

    const [empRes, attRes, holRes, shiftRes, leaveRes] = await Promise.all([
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
        .select('employee_id')
        .eq('status', 'approved')
        .lte('from_date', today)
        .gte('to_date', today),
    ])

    if (empRes.error) throw empRes.error
    if (attRes.error) throw attRes.error
    if (holRes.error) throw holRes.error
    if (leaveRes.error) throw leaveRes.error

    const employees = empRes.data ?? []
    const records = attRes.data ?? []
    const isHoliday = (holRes.data ?? []).length > 0
    const weeklyOffDays = new Set<number>((shiftRes.data?.[0]?.weekly_off_days as number[] | undefined) ?? [0])
    const dayOfWeek = new Date(today).getDay()
    const isWeeklyOff = !isHoliday && weeklyOffDays.has(dayOfWeek)
    const onLeaveIds = new Set((leaveRes.data ?? []).map((l) => l.employee_id))

    const recordMap = new Map<string, (typeof records)[0]>()
    for (const r of records) {
      recordMap.set(r.employee_id, r)
    }

    const rows = employees.map((emp) => {
      const dept = emp.department as { name: string } | null
      const rec = recordMap.get(emp.id)
      let status = rec?.status ?? 'not_checked_in'
      if (!rec) {
        if (onLeaveIds.has(emp.id)) status = 'on_leave'
        else if (isHoliday) status = 'holiday'
        else if (isWeeklyOff) status = 'weekly_off'
        else status = 'not_checked_in'
      }
      return {
        name: `${emp.first_name} ${emp.last_name}`,
        code: emp.employee_code,
        department: dept?.name ?? '-',
        status,
        checkIn: rec?.check_in_time ?? null,
        isLate: rec?.is_late ?? false,
        isWfh: rec?.is_wfh ?? false,
      }
    })

    const count = (s: string) => rows.filter((r) => r.status === s).length
    const counts = {
      present: count('present'),
      late: count('late'),
      halfDay: count('half_day'),
      wfh: count('work_from_home'),
      onLeave: count('on_leave'),
      notCheckedIn: count('not_checked_in'),
    }

    const attendanceTable = rows
      .map(
        (r) => {
          const statusLabel = r.status === 'not_checked_in'
            ? '<span style="color:#dc2626;">Not Checked In</span>'
            : STATUS_LABELS[r.status] ?? r.status
          const statusCell = STATUS_LABELS[r.status] ? esc(STATUS_LABELS[r.status]) : null
          return `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 8px; font-size: 13px;">${esc(r.name)}</td>
            <td style="padding: 6px 8px; font-size: 12px; color: #666;">${esc(r.code)}</td>
            <td style="padding: 6px 8px; font-size: 13px;">${esc(r.department)}</td>
            <td style="padding: 6px 8px; font-size: 13px;">${r.status === 'not_checked_in' ? statusLabel : esc(statusCell ?? r.status)}</td>
            <td style="padding: 6px 8px; font-size: 12px; font-family: monospace;">${fmtTime(r.checkIn)}</td>
            <td style="padding: 6px 8px; font-size: 13px; text-align: center;">${r.isWfh ? 'Yes' : 'N/A'}</td>
            <td style="padding: 6px 8px; font-size: 13px; text-align: center;">${r.isLate ? 'Yes' : 'N/A'}</td>
          </tr>`
        }
      )
      .join('')

    const dayLabel = isHoliday ? ' (Holiday)' : isWeeklyOff ? ' (Weekly Off)' : ''

    await sendEmail({
      to: overrideTo ?? owner.email,
      subject: `Check-In Summary - ${today}`,
      html: `
        <h2 style="margin: 0 0 4px;">Midday Check-In Summary</h2>
        <p style="margin: 0 0 16px; color: #666; font-size: 13px;">${today}${dayLabel}</p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="padding: 8px; text-align: center; background: #f0fdf4; border: 1px solid #e2e2e2; border-radius: 6px; width: 16.6%;">
              <div style="font-size: 20px; font-weight: 700; color: #16a34a;">${counts.present}</div>
              <div style="font-size: 11px; color: #666;">Checked In</div>
            </td>
            <td style="padding: 8px; text-align: center; background: #fff7ed; border: 1px solid #e2e2e2; border-radius: 6px; width: 16.6%;">
              <div style="font-size: 20px; font-weight: 700; color: #ea580c;">${counts.late}</div>
              <div style="font-size: 11px; color: #666;">Late</div>
            </td>
            <td style="padding: 8px; text-align: center; background: #eff6ff; border: 1px solid #e2e2e2; border-radius: 6px; width: 16.6%;">
              <div style="font-size: 20px; font-weight: 700; color: #2563eb;">${counts.wfh}</div>
              <div style="font-size: 11px; color: #666;">WFH</div>
            </td>
            <td style="padding: 8px; text-align: center; background: #fefce8; border: 1px solid #e2e2e2; border-radius: 6px; width: 16.6%;">
              <div style="font-size: 20px; font-weight: 700; color: #ca8a04;">${counts.halfDay}</div>
              <div style="font-size: 11px; color: #666;">Half Day</div>
            </td>
            <td style="padding: 8px; text-align: center; background: #faf5ff; border: 1px solid #e2e2e2; border-radius: 6px; width: 16.6%;">
              <div style="font-size: 20px; font-weight: 700; color: #9333ea;">${counts.onLeave}</div>
              <div style="font-size: 11px; color: #666;">On Leave</div>
            </td>
            <td style="padding: 8px; text-align: center; background: #fef2f2; border: 1px solid #e2e2e2; border-radius: 6px; width: 16.6%;">
              <div style="font-size: 20px; font-weight: 700; color: #dc2626;">${counts.notCheckedIn}</div>
              <div style="font-size: 11px; color: #666;">Not Checked In</div>
            </td>
          </tr>
        </table>

        <h3 style="font-size: 14px; margin: 0 0 8px;">Today's Status (${employees.length} employees)</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e2e2;">
          <thead>
            <tr style="background: #f8fafc; text-align: left;">
              <th style="padding: 6px 8px; font-size: 12px;">Employee</th>
              <th style="padding: 6px 8px; font-size: 12px;">Code</th>
              <th style="padding: 6px 8px; font-size: 12px;">Department</th>
              <th style="padding: 6px 8px; font-size: 12px;">Status</th>
              <th style="padding: 6px 8px; font-size: 12px;">Check In</th>
              <th style="padding: 6px 8px; font-size: 12px; text-align: center;">WFH</th>
              <th style="padding: 6px 8px; font-size: 12px; text-align: center;">Late</th>
            </tr>
          </thead>
          <tbody>${attendanceTable}</tbody>
        </table>

        <hr style="border: none; border-top: 1px solid #e2e2e2; margin: 24px 0 12px;" />
        <p style="color: #666; font-size: 12px;">This is an automated message from the HR system.</p>
      `,
    })

    return ok({ processed: 1, date: today, owner: owner.email, to: overrideTo ?? owner.email })
  } catch (e) {
    return handleError(e)
  }
})