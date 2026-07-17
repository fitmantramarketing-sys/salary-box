export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          check_in_ip: unknown
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_time: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_time: string | null
          checkout_reminder_sent_at: string | null
          created_at: string
          date: string
          early_checkout_reason: string | null
          early_checkout_status: string | null
          employee_id: string
          id: string
          is_geo_flagged: boolean
          is_late: boolean
          is_manually_entered: boolean
          is_wfh: boolean
          manual_entry_by: string | null
          manual_entry_reason: string | null
          overtime_approved: boolean | null
          overtime_approved_by: string | null
          overtime_hours: number | null
          shift_id: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          total_hours: number | null
          updated_at: string
        }
        Insert: {
          check_in_ip?: unknown
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_time?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_time?: string | null
          checkout_reminder_sent_at?: string | null
          created_at?: string
          date: string
          early_checkout_reason?: string | null
          early_checkout_status?: string | null
          employee_id: string
          id?: string
          is_geo_flagged?: boolean
          is_late?: boolean
          is_manually_entered?: boolean
          is_wfh?: boolean
          manual_entry_by?: string | null
          manual_entry_reason?: string | null
          overtime_approved?: boolean | null
          overtime_approved_by?: string | null
          overtime_hours?: number | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          total_hours?: number | null
          updated_at?: string
        }
        Update: {
          check_in_ip?: unknown
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_time?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_time?: string | null
          checkout_reminder_sent_at?: string | null
          created_at?: string
          date?: string
          early_checkout_reason?: string | null
          early_checkout_status?: string | null
          employee_id?: string
          id?: string
          is_geo_flagged?: boolean
          is_late?: boolean
          is_manually_entered?: boolean
          is_wfh?: boolean
          manual_entry_by?: string | null
          manual_entry_reason?: string | null
          overtime_approved?: boolean | null
          overtime_approved_by?: string | null
          overtime_hours?: number | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          total_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_manual_entry_by_fkey"
            columns: ["manual_entry_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_overtime_approved_by_fkey"
            columns: ["overtime_approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_regularization_requests: {
        Row: {
          attendance_record_id: string
          created_at: string
          employee_id: string
          id: string
          reason: string
          requested_check_in: string | null
          requested_check_out: string | null
          requested_status: Database["public"]["Enums"]["attendance_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_comment: string | null
          status: Database["public"]["Enums"]["regularization_status"]
        }
        Insert: {
          attendance_record_id: string
          created_at?: string
          employee_id: string
          id?: string
          reason: string
          requested_check_in?: string | null
          requested_check_out?: string | null
          requested_status: Database["public"]["Enums"]["attendance_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_comment?: string | null
          status?: Database["public"]["Enums"]["regularization_status"]
        }
        Update: {
          attendance_record_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          reason?: string
          requested_check_in?: string | null
          requested_check_out?: string | null
          requested_status?: Database["public"]["Enums"]["attendance_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_comment?: string | null
          status?: Database["public"]["Enums"]["regularization_status"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_regularization_requests_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_regularization_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_regularization_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          actor_system_function: string | null
          created_at: string
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          actor_system_function?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          actor_system_function?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      department_shifts: {
        Row: {
          department_id: string
          effective_from: string
          effective_to: string | null
          id: string
          shift_id: string
        }
        Insert: {
          department_id: string
          effective_from: string
          effective_to?: string | null
          id?: string
          shift_id: string
        }
        Update: {
          department_id?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_shifts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_shifts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          created_by: string | null
          depth: number
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          depth?: number
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          depth?: number
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      designations: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "designations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_bank_details: {
        Row: {
          account_holder_name: string
          account_number_encrypted: string
          account_number_last4: string
          bank_name: string
          created_at: string
          employee_id: string
          id: string
          ifsc_code: string
          is_active: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_holder_name: string
          account_number_encrypted: string
          account_number_last4: string
          bank_name: string
          created_at?: string
          employee_id: string
          id?: string
          ifsc_code: string
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_holder_name?: string
          account_number_encrypted?: string
          account_number_last4?: string
          bank_name?: string
          created_at?: string
          employee_id?: string
          id?: string
          ifsc_code?: string
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_bank_details_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_bank_details_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          created_at: string
          document_hash: string | null
          document_type: string
          employee_id: string
          file_name: string
          file_size_bytes: number
          id: string
          is_active: boolean
          mime_type: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          document_hash?: string | null
          document_type: string
          employee_id: string
          file_name: string
          file_size_bytes: number
          id?: string
          is_active?: boolean
          mime_type: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          document_hash?: string | null
          document_type?: string
          employee_id?: string
          file_name?: string
          file_size_bytes?: number
          id?: string
          is_active?: boolean
          mime_type?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_lifecycle_events: {
        Row: {
          created_at: string
          document_path: string | null
          effective_date: string
          employee_id: string
          event_type: Database["public"]["Enums"]["lifecycle_event_type"]
          id: string
          new_department_id: string | null
          new_designation_id: string | null
          new_salary: number | null
          performed_by: string
          previous_department_id: string | null
          previous_designation_id: string | null
          previous_salary: number | null
          reason: string | null
        }
        Insert: {
          created_at?: string
          document_path?: string | null
          effective_date: string
          employee_id: string
          event_type: Database["public"]["Enums"]["lifecycle_event_type"]
          id?: string
          new_department_id?: string | null
          new_designation_id?: string | null
          new_salary?: number | null
          performed_by: string
          previous_department_id?: string | null
          previous_designation_id?: string | null
          previous_salary?: number | null
          reason?: string | null
        }
        Update: {
          created_at?: string
          document_path?: string | null
          effective_date?: string
          employee_id?: string
          event_type?: Database["public"]["Enums"]["lifecycle_event_type"]
          id?: string
          new_department_id?: string | null
          new_designation_id?: string | null
          new_salary?: number | null
          performed_by?: string
          previous_department_id?: string | null
          previous_designation_id?: string | null
          previous_salary?: number | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_lifecycle_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_lifecycle_events_new_department_id_fkey"
            columns: ["new_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_lifecycle_events_new_designation_id_fkey"
            columns: ["new_designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_lifecycle_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_lifecycle_events_previous_department_id_fkey"
            columns: ["previous_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_lifecycle_events_previous_designation_id_fkey"
            columns: ["previous_designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_onboarding_progress: {
        Row: {
          checklist_item_id: string
          completed_at: string | null
          completed_by: string | null
          employee_id: string
          id: string
          is_completed: boolean
        }
        Insert: {
          checklist_item_id: string
          completed_at?: string | null
          completed_by?: string | null
          employee_id: string
          id?: string
          is_completed?: boolean
        }
        Update: {
          checklist_item_id?: string
          completed_at?: string | null
          completed_by?: string | null
          employee_id?: string
          id?: string
          is_completed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "employee_onboarding_progress_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "onboarding_checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_onboarding_progress_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_onboarding_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_optional_holidays: {
        Row: {
          created_at: string
          employee_id: string
          holiday_id: string
          id: string
          year: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          holiday_id: string
          id?: string
          year: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          holiday_id?: string
          id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_optional_holidays_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_optional_holidays_holiday_id_fkey"
            columns: ["holiday_id"]
            isOneToOne: false
            referencedRelation: "holidays"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_shift_overrides: {
        Row: {
          assigned_by: string
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          shift_id: string
        }
        Insert: {
          assigned_by: string
          effective_from: string
          effective_to?: string | null
          employee_id: string
          id?: string
          shift_id: string
        }
        Update: {
          assigned_by?: string
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_shift_overrides_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shift_overrides_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shift_overrides_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          auth_id: string | null
          city: string | null
          created_at: string
          created_by: string | null
          current_salary: number | null
          date_of_birth: string | null
          department_id: string | null
          designation_id: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_code: string
          employment_status: Database["public"]["Enums"]["employment_status"]
          employment_type: Database["public"]["Enums"]["employment_type"]
          exit_date: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          is_active: boolean
          is_first_login: boolean
          join_date: string
          last_name: string
          personal_email: string | null
          phone: string | null
          photo_url: string | null
          pincode: string | null
          previous_employee_id: string | null
          probation_end_date: string | null
          reporting_manager_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          auth_id?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          current_salary?: number | null
          date_of_birth?: string | null
          department_id?: string | null
          designation_id?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          employment_type?: Database["public"]["Enums"]["employment_type"]
          exit_date?: string | null
          first_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          is_active?: boolean
          is_first_login?: boolean
          join_date: string
          last_name: string
          personal_email?: string | null
          phone?: string | null
          photo_url?: string | null
          pincode?: string | null
          previous_employee_id?: string | null
          probation_end_date?: string | null
          reporting_manager_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          auth_id?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          current_salary?: number | null
          date_of_birth?: string | null
          department_id?: string | null
          designation_id?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code?: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          employment_type?: Database["public"]["Enums"]["employment_type"]
          exit_date?: string | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          is_active?: boolean
          is_first_login?: boolean
          join_date?: string
          last_name?: string
          personal_email?: string | null
          phone?: string | null
          photo_url?: string | null
          pincode?: string | null
          previous_employee_id?: string | null
          probation_end_date?: string | null
          reporting_manager_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_previous_employee_id_fkey"
            columns: ["previous_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_reporting_manager_id_fkey"
            columns: ["reporting_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_config: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          label: string
          latitude: number
          longitude: number
          radius_meters: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          label: string
          latitude: number
          longitude: number
          radius_meters?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          label?: string
          latitude?: number
          longitude?: number
          radius_meters?: number
        }
        Relationships: [
          {
            foreignKeyName: "geofence_config_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          is_optional: boolean
          name: string
          state_code: string | null
          type: Database["public"]["Enums"]["holiday_type"]
          year: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_optional?: boolean
          name: string
          state_code?: string | null
          type: Database["public"]["Enums"]["holiday_type"]
          year: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_optional?: boolean
          name?: string
          state_code?: string | null
          type?: Database["public"]["Enums"]["holiday_type"]
          year?: number
        }
        Relationships: []
      }
      ip_whitelist: {
        Row: {
          created_at: string
          created_by: string
          id: string
          ip_range: unknown
          is_active: boolean
          label: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          ip_range: unknown
          is_active?: boolean
          label: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          ip_range?: unknown
          is_active?: boolean
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "ip_whitelist_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_applications: {
        Row: {
          applied_at: string
          attachment_path: string | null
          cancellation_reason: string | null
          cancellation_requested: boolean
          cancellation_requested_at: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          employee_id: string
          escalated_at: string | null
          escalated_to: string | null
          from_date: string
          half_day_period: string | null
          id: string
          is_half_day: boolean
          leave_type_id: string
          lwp_days: number
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_comment: string | null
          status: Database["public"]["Enums"]["leave_status"]
          to_date: string
          working_days_count: number
        }
        Insert: {
          applied_at?: string
          attachment_path?: string | null
          cancellation_reason?: string | null
          cancellation_requested?: boolean
          cancellation_requested_at?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          employee_id: string
          escalated_at?: string | null
          escalated_to?: string | null
          from_date: string
          half_day_period?: string | null
          id?: string
          is_half_day?: boolean
          leave_type_id: string
          lwp_days?: number
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_comment?: string | null
          status?: Database["public"]["Enums"]["leave_status"]
          to_date: string
          working_days_count: number
        }
        Update: {
          applied_at?: string
          attachment_path?: string | null
          cancellation_reason?: string | null
          cancellation_requested?: boolean
          cancellation_requested_at?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          employee_id?: string
          escalated_at?: string | null
          escalated_to?: string | null
          from_date?: string
          half_day_period?: string | null
          id?: string
          is_half_day?: boolean
          leave_type_id?: string
          lwp_days?: number
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_comment?: string | null
          status?: Database["public"]["Enums"]["leave_status"]
          to_date?: string
          working_days_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_applications_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_applications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_applications_escalated_to_fkey"
            columns: ["escalated_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_applications_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          accrued: number
          adjusted: number
          annual_allocation: number
          carry_forward_amount: number
          carry_forward_expiry: string | null
          employee_id: string
          id: string
          leave_type_id: string
          opening_balance: number
          pending: number
          taken: number
          updated_at: string
          year: number
        }
        Insert: {
          accrued?: number
          adjusted?: number
          annual_allocation?: number
          carry_forward_amount?: number
          carry_forward_expiry?: string | null
          employee_id: string
          id?: string
          leave_type_id: string
          opening_balance?: number
          pending?: number
          taken?: number
          updated_at?: string
          year: number
        }
        Update: {
          accrued?: number
          adjusted?: number
          annual_allocation?: number
          carry_forward_amount?: number
          carry_forward_expiry?: string | null
          employee_id?: string
          id?: string
          leave_type_id?: string
          opening_balance?: number
          pending?: number
          taken?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          accrual_days: number | null
          accrual_type: Database["public"]["Enums"]["leave_accrual_type"]
          allow_negative_balance: boolean
          applicable_gender: Database["public"]["Enums"]["gender"] | null
          attachment_required_after_days: number | null
          carry_forward_expiry_days: number | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_encashable: boolean
          is_lwp: boolean
          max_carry_forward_days: number
          max_consecutive_days: number | null
          max_per_month: number | null
          min_notice_days: number
          name: string
          requires_attachment: boolean
          updated_at: string
        }
        Insert: {
          accrual_days?: number | null
          accrual_type?: Database["public"]["Enums"]["leave_accrual_type"]
          allow_negative_balance?: boolean
          applicable_gender?: Database["public"]["Enums"]["gender"] | null
          attachment_required_after_days?: number | null
          carry_forward_expiry_days?: number | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_encashable?: boolean
          is_lwp?: boolean
          max_carry_forward_days?: number
          max_consecutive_days?: number | null
          max_per_month?: number | null
          min_notice_days?: number
          name: string
          requires_attachment?: boolean
          updated_at?: string
        }
        Update: {
          accrual_days?: number | null
          accrual_type?: Database["public"]["Enums"]["leave_accrual_type"]
          allow_negative_balance?: boolean
          applicable_gender?: Database["public"]["Enums"]["gender"] | null
          attachment_required_after_days?: number | null
          carry_forward_expiry_days?: number | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_encashable?: boolean
          is_lwp?: boolean
          max_carry_forward_days?: number
          max_consecutive_days?: number | null
          max_per_month?: number | null
          min_notice_days?: number
          name?: string
          requires_attachment?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      location_snapshots: {
        Row: {
          action: string
          attendance_record_id: string | null
          created_at: string
          employee_id: string
          error_code: string | null
          id: string
          inside_geofence: boolean | null
          ip: unknown
          latitude: number | null
          longitude: number | null
          successful: boolean
        }
        Insert: {
          action: string
          attendance_record_id?: string | null
          created_at?: string
          employee_id: string
          error_code?: string | null
          id?: string
          inside_geofence?: boolean | null
          ip?: unknown
          latitude?: number | null
          longitude?: number | null
          successful?: boolean
        }
        Update: {
          action?: string
          attendance_record_id?: string | null
          created_at?: string
          employee_id?: string
          error_code?: string | null
          id?: string
          inside_geofence?: boolean | null
          ip?: unknown
          latitude?: number | null
          longitude?: number | null
          successful?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "location_snapshots_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_snapshots_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          read_at: string | null
          recipient_id: string
          reference_id: string | null
          reference_table: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          recipient_id: string
          reference_id?: string | null
          reference_table?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          recipient_id?: string
          reference_id?: string | null
          reference_table?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklist_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_required: boolean
          item_name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          item_name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          item_name?: string
          sort_order?: number
        }
        Relationships: []
      }
      profile_edit_requests: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          requested_changes: Json
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          requested_changes: Json
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          requested_changes?: Json
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_edit_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_edit_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          employee_id: string
          endpoint: string
          id: string
          p256dh_key: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          employee_id: string
          endpoint: string
          id?: string
          p256dh_key: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          employee_id?: string
          endpoint?: string
          id?: string
          p256dh_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          break_minutes: number
          created_at: string
          end_time: string
          grace_period_minutes: number
          id: string
          is_active: boolean
          is_default: boolean
          is_night_shift: boolean
          late_mark_threshold: number
          name: string
          saturday_end_time: string | null
          saturday_start_time: string | null
          start_time: string
          updated_at: string
          weekly_off_days: number[]
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          end_time: string
          grace_period_minutes?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_night_shift?: boolean
          late_mark_threshold?: number
          name: string
          saturday_end_time?: string | null
          saturday_start_time?: string | null
          start_time: string
          updated_at?: string
          weekly_off_days?: number[]
        }
        Update: {
          break_minutes?: number
          created_at?: string
          end_time?: string
          grace_period_minutes?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_night_shift?: boolean
          late_mark_threshold?: number
          name?: string
          saturday_end_time?: string | null
          saturday_start_time?: string | null
          start_time?: string
          updated_at?: string
          weekly_off_days?: number[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_employee_name: {
        Args: { p_id: string }
        Returns: {
          first_name: string
          id: string
          last_name: string
        }[]
      }
      get_my_employee_id: { Args: never; Returns: string }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      uuid_generate_v5: {
        Args: { name: string; namespace: string }
        Returns: string
      }
    }
    Enums: {
      attendance_status:
        | "present"
        | "absent"
        | "half_day"
        | "work_from_home"
        | "on_leave"
        | "holiday"
        | "weekly_off"
        | "incomplete"
        | "late"
      employment_status:
        | "active"
        | "on_probation"
        | "resigned"
        | "terminated"
        | "on_leave"
        | "future_joiner"
      employment_type: "full_time" | "part_time" | "contractor" | "intern"
      gender: "male" | "female" | "other" | "prefer_not_to_say"
      holiday_type: "national" | "state" | "company" | "optional"
      leave_accrual_type: "monthly" | "yearly" | "manual"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      lifecycle_event_type:
        | "onboarding"
        | "promotion"
        | "transfer"
        | "salary_revision"
        | "resignation"
        | "termination"
        | "rehire"
      regularization_status: "pending" | "approved" | "rejected" | "withdrawn"
      user_role: "owner" | "hr" | "employee" | "system_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      attendance_status: [
        "present",
        "absent",
        "half_day",
        "work_from_home",
        "on_leave",
        "holiday",
        "weekly_off",
        "incomplete",
        "late",
      ],
      employment_status: [
        "active",
        "on_probation",
        "resigned",
        "terminated",
        "on_leave",
        "future_joiner",
      ],
      employment_type: ["full_time", "part_time", "contractor", "intern"],
      gender: ["male", "female", "other", "prefer_not_to_say"],
      holiday_type: ["national", "state", "company", "optional"],
      leave_accrual_type: ["monthly", "yearly", "manual"],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      lifecycle_event_type: [
        "onboarding",
        "promotion",
        "transfer",
        "salary_revision",
        "resignation",
        "termination",
        "rehire",
      ],
      regularization_status: ["pending", "approved", "rejected", "withdrawn"],
      user_role: ["owner", "hr", "employee", "system_admin"],
    },
  },
} as const
