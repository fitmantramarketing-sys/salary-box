import { z } from 'zod'

export const submitRegularizationSchema = z.object({
  attendance_record_id: z.string().uuid(),
  requested_status: z.enum(['present', 'half_day', 'work_from_home']),
  requested_check_in: z.string().optional(),
  requested_check_out: z.string().optional(),
  reason: z.string().min(5, 'Please provide a reason'),
})
export type SubmitRegularizationForm = z.infer<typeof submitRegularizationSchema>

export const manualAttendanceSchema = z.object({
  employee_id: z.string().uuid(),
  date: z.string().min(1, 'Date is required'),
  check_in_time: z.string().optional(),
  check_out_time: z.string().optional(),
  is_wfh: z.boolean().default(false),
  reason: z.string().min(5, 'Please provide a reason'),
}).superRefine((data, ctx) => {
  if (data.check_in_time && new Date(data.check_in_time) > new Date()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cannot be in the future', path: ['check_in_time'] })
  }
  if (data.check_out_time && new Date(data.check_out_time) > new Date()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cannot be in the future', path: ['check_out_time'] })
  }
})
export type ManualAttendanceForm = z.infer<typeof manualAttendanceSchema>
