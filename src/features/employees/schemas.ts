import { z } from 'zod'

export const createEmployeeSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  personal_email: z.string().email().optional().or(z.literal('')),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  department_id: z.string().uuid('Select a department').optional(),
  designation_id: z.string().uuid('Select a designation').optional(),
  reporting_manager_id: z.string().uuid().optional(),
  role: z.enum(['owner', 'hr', 'employee', 'system_admin']).default('employee'),
  employment_type: z.enum(['full_time', 'part_time', 'contractor', 'intern']).default('full_time'),
  join_date: z.string().min(1, 'Join date is required'),
  probation_end_date: z.string().optional(),
  current_salary: z.number().positive().optional(),
  leave_allocations: z.array(z.object({
    leave_type_id: z.string().uuid(),
    days: z.number().min(0),
  })).optional(),
})
export type CreateEmployeeForm = z.infer<typeof createEmployeeSchema>

export const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  parent_id: z.string().uuid().optional(),
})
export type DepartmentForm = z.infer<typeof departmentSchema>

export const designationSchema = z.object({
  name: z.string().min(1, 'Designation name is required'),
  department_id: z.string().uuid().optional(),
})
export type DesignationForm = z.infer<typeof designationSchema>

export const lifecycleEventSchema = z.object({
  employee_id: z.string().uuid(),
  event_type: z.enum(['promotion', 'transfer', 'salary_revision', 'resignation', 'termination', 'rehire']),
  effective_date: z.string().min(1, 'Effective date is required'),
  previous_department_id: z.string().uuid().nullable().optional(),
  new_department_id: z.string().uuid().nullable().optional(),
  previous_designation_id: z.string().uuid().nullable().optional(),
  new_designation_id: z.string().uuid().nullable().optional(),
  previous_salary: z.number().positive().nullable().optional(),
  new_salary: z.number().positive().nullable().optional(),
  reason: z.string().nullable().optional(),
  document_path: z.string().nullable().optional(),
})

export const uploadDocumentSchema = z.object({
  employee_id: z.string().uuid(),
  document_type: z.enum(['aadhar', 'pan', 'offer_letter', 'appointment_letter', 'experience_letter', 'other']),
  file: z.instanceof(File).refine((f) => f.size <= 5 * 1024 * 1024, 'File must be under 5MB'),
  force: z.boolean().optional(),
  override_reason: z.string().optional(),
})
