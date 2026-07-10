import type { Database } from './database.types'

// ─── Table row types ──────────────────────────────────────────────────────────
export type Employee = Database['public']['Tables']['employees']['Row']
export type Department = Database['public']['Tables']['departments']['Row']
export type Designation = Database['public']['Tables']['designations']['Row']
export type AttendanceRecord = Database['public']['Tables']['attendance_records']['Row']
export type LeaveType = Database['public']['Tables']['leave_types']['Row']
export type LeaveBalance = Database['public']['Tables']['leave_balances']['Row']
export type LeaveApplication = Database['public']['Tables']['leave_applications']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type AppConfig = Database['public']['Tables']['app_config']['Row']
export type EmployeeDocument = Database['public']['Tables']['employee_documents']['Row']
export type EmployeeBankDetail = Database['public']['Tables']['employee_bank_details']['Row']
export type EmployeeLifecycleEvent = Database['public']['Tables']['employee_lifecycle_events']['Row']
export type EmployeeOnboardingProgress = Database['public']['Tables']['employee_onboarding_progress']['Row']
export type OnboardingChecklistTemplate = Database['public']['Tables']['onboarding_checklist_templates']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type Shift = Database['public']['Tables']['shifts']['Row']
export type DepartmentShift = Database['public']['Tables']['department_shifts']['Row']
export type EmployeeShiftOverride = Database['public']['Tables']['employee_shift_overrides']['Row']
export type RegularizationRequest = Database['public']['Tables']['attendance_regularization_requests']['Row']
export type LocationSnapshot = Database['public']['Tables']['location_snapshots']['Row']
export type Holiday = Database['public']['Tables']['holidays']['Row']

// ─── Role ─────────────────────────────────────────────────────────────────────
export type Role = Employee['role']

// ─── Edge Function error shape (returned on non-2xx) ─────────────────────────
export type EdgeError = {
  code: string
  message: string
  details?: unknown
}

// ─── Edge Function response shapes ───────────────────────────────────────────
export type CheckInResponse = {
  attendance_record_id: string
  check_in_time: string
  is_late: boolean
  is_geo_flagged: boolean
  status?: string | null
  late_count_this_month?: number
  late_threshold?: number
}

export type CheckOutResponse = {
  attendance_record_id: string
  check_out_time: string
  total_hours: number
  is_geo_flagged: boolean
}

export type SubmitLeaveResponse = {
  application_id: string
  working_days_count: number
  status: LeaveApplication['status']
  escalated_to: string | null
}

export type CreateEmployeeResponse = {
  employee_id: string
  employee_code: string
  employment_status: Employee['employment_status']
  temporary_password: string
}

export type UploadDocumentResponse = {
  document_id: string
  storage_path: string
}

export type AddLifecycleEventResponse = {
  event_id: string
}

export type PresignedUrlResponse = {
  url: string
  expires_at: string
}

// ─── Derived display types ────────────────────────────────────────────────────
export type EmployeeWithRelations = Employee & {
  department: Department | null
  designation: Designation | null
  reporting_manager: Pick<Employee, 'id' | 'first_name' | 'last_name'> | null
}

export type LeaveApplicationWithRelations = LeaveApplication & {
  leave_type: LeaveType
  employee?: Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_code'> | null
}

export type EmployeeDocumentWithPresignedUrl = EmployeeDocument & {
  presigned_url?: string
  presigned_url_expires_at?: string
}

export type EmployeeLifecycleEventWithRelations = EmployeeLifecycleEvent & {
  performer?: Pick<Employee, 'id' | 'first_name' | 'last_name'> | null
  previous_department?: Pick<Department, 'id' | 'name'> | null
  new_department?: Pick<Department, 'id' | 'name'> | null
  previous_designation?: Pick<Designation, 'id' | 'name'> | null
  new_designation?: Pick<Designation, 'id' | 'name'> | null
}

export type OnboardingProgressWithTemplate = EmployeeOnboardingProgress & {
  template: OnboardingChecklistTemplate | null
}

export type LeaveBalanceWithType = LeaveBalance & {
  leave_type: LeaveType
}
