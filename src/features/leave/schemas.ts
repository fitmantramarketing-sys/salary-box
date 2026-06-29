import { z } from 'zod'

export const submitLeaveSchema = z.object({
  leave_type_id: z.string().uuid('Select a leave type'),
  from_date: z.string().min(1, 'Start date is required'),
  to_date: z.string().min(1, 'End date is required'),
  is_half_day: z.boolean().default(false),
  half_day_period: z.enum(['morning', 'afternoon']).nullable().optional(),
  reason: z.string().min(5, 'Please provide a reason (min 5 characters)'),
  attachment_path: z.string().nullable().optional(),
})
export type SubmitLeaveForm = z.infer<typeof submitLeaveSchema>

export const reviewLeaveSchema = z.object({
  application_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  comment: z.string().optional(),
})
export type ReviewLeaveForm = z.infer<typeof reviewLeaveSchema>

