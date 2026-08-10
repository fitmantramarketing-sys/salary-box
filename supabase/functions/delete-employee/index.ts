import { getActor, assertRole } from '../_shared/auth.ts'
import { ok, err, cors, handleError } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/supabase.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner'])

    const body = await req.json()
    const { employee_id, confirmation } = body

    if (!employee_id) {
      return err('VALIDATION_ERROR', 'employee_id is required', 400)
    }

    const supabase = getServiceClient()

    const { data: employee, error: fetchError } = await supabase
      .from('employees')
      .select('id, employee_code, first_name, last_name, auth_id, is_active')
      .eq('id', employee_id)
      .single()

    if (fetchError || !employee) {
      return err('NOT_FOUND', 'Employee not found', 404)
    }

    if (actor.actorId === employee.id) {
      return err('FORBIDDEN', 'You cannot delete your own account', 403)
    }

    if (employee.is_active) {
      return err('CONFLICT', 'Employee must be deactivated before it can be permanently deleted', 409)
    }

    if (!confirmation || String(confirmation).trim().toUpperCase() !== employee.employee_code.toUpperCase()) {
      return err('VALIDATION_ERROR', 'Confirmation must match the employee code', 400)
    }

    const { data: orphanedReports } = await supabase
      .from('employees')
      .select('id, first_name, last_name, employee_code')
      .eq('reporting_manager_id', employee_id)
      .eq('is_active', true)

    if (orphanedReports && orphanedReports.length > 0) {
      return err('CONFLICT', `${orphanedReports.length} employee(s) still report to this person. Reassign before deleting.`, 409, {
        affected_employees: orphanedReports,
      })
    }

    const actorRefNulls: [string, string][] = [
      ['audit_logs', 'actor_id'],
      ['announcements', 'created_by'],
      ['app_config', 'updated_by'],
      ['departments', 'created_by'],
      ['geofence_config', 'created_by'],
      ['ip_whitelist', 'created_by'],
      ['employee_bank_details', 'updated_by'],
      ['employee_documents', 'uploaded_by'],
      ['employee_lifecycle_events', 'performed_by'],
      ['employee_onboarding_progress', 'completed_by'],
      ['employee_shift_overrides', 'assigned_by'],
      ['attendance_records', 'manual_entry_by'],
      ['attendance_records', 'overtime_approved_by'],
      ['attendance_regularization_requests', 'reviewed_by'],
      ['leave_applications', 'escalated_to'],
      ['leave_applications', 'reviewed_by'],
      ['leave_applications', 'cancelled_by'],
      ['profile_edit_requests', 'reviewed_by'],
    ]

    for (const [table, column] of actorRefNulls) {
      const { error } = await supabase.from(table).update({ [column]: null }).eq(column, employee_id)
      if (error) {
        console.error(`Failed to null ${table}.${column}:`, error)
        return err('INTERNAL_ERROR', `Failed to clean up references in ${table}.${column}: ${error.message}`, 500)
      }
    }

    const { error: selfRefError } = await supabase
      .from('employees')
      .update({ reporting_manager_id: null })
      .eq('reporting_manager_id', employee_id)
    if (selfRefError) {
      console.error('Failed to null reporting_manager_id:', selfRefError)
      return err('INTERNAL_ERROR', `Failed to clean up employee references: ${selfRefError.message}`, 500)
    }

    const { error: prevRefError } = await supabase
      .from('employees')
      .update({ previous_employee_id: null })
      .eq('previous_employee_id', employee_id)
    if (prevRefError) {
      console.error('Failed to null previous_employee_id:', prevRefError)
      return err('INTERNAL_ERROR', `Failed to clean up employee references: ${prevRefError.message}`, 500)
    }

    const { error: createdByError } = await supabase
      .from('employees')
      .update({ created_by: null })
      .eq('created_by', employee_id)
    if (createdByError) {
      console.error('Failed to null created_by:', createdByError)
      return err('INTERNAL_ERROR', `Failed to clean up employee references: ${createdByError.message}`, 500)
    }

    const storagePaths: string[] = []

    const { data: documents, error: docFetchError } = await supabase
      .from('employee_documents')
      .select('storage_path')
      .eq('employee_id', employee_id)
    if (docFetchError) {
      console.error('Failed to fetch documents:', docFetchError)
    } else {
      for (const d of documents ?? []) {
        if (d.storage_path) storagePaths.push(d.storage_path)
      }
    }

    const { data: leaveApps, error: leaveFetchError } = await supabase
      .from('leave_applications')
      .select('attachment_path')
      .eq('employee_id', employee_id)
    if (leaveFetchError) {
      console.error('Failed to fetch leave applications:', leaveFetchError)
    } else {
      for (const l of leaveApps ?? []) {
        if (l.attachment_path) storagePaths.push(l.attachment_path)
      }
    }

    const { data: attendanceIds, error: attFetchError } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('employee_id', employee_id)
    if (attFetchError) {
      console.error('Failed to fetch attendance records:', attFetchError)
      return err('INTERNAL_ERROR', `Failed to fetch attendance records: ${attFetchError.message}`, 500)
    }
    const recordIds = (attendanceIds ?? []).map((r) => r.id)

    if (recordIds.length > 0) {
      const { error: snapError } = await supabase
        .from('location_snapshots')
        .delete()
        .in('attendance_record_id', recordIds)
      if (snapError) {
        console.error('Failed to delete location snapshots:', snapError)
        return err('INTERNAL_ERROR', `Failed to delete location snapshots: ${snapError.message}`, 500)
      }

      const { error: regError } = await supabase
        .from('attendance_regularization_requests')
        .delete()
        .in('attendance_record_id', recordIds)
      if (regError) {
        console.error('Failed to delete regularization requests:', regError)
        return err('INTERNAL_ERROR', `Failed to delete regularization requests: ${regError.message}`, 500)
      }

      const { error: attError } = await supabase
        .from('attendance_records')
        .delete()
        .in('id', recordIds)
      if (attError) {
        console.error('Failed to delete attendance records:', attError)
        return err('INTERNAL_ERROR', `Failed to delete attendance records: ${attError.message}`, 500)
      }
    }

    const ownedTables: [string, string][] = [
      ['employee_documents', 'employee_id'],
      ['employee_bank_details', 'employee_id'],
      ['employee_lifecycle_events', 'employee_id'],
      ['employee_onboarding_progress', 'employee_id'],
      ['employee_optional_holidays', 'employee_id'],
      ['employee_shift_overrides', 'employee_id'],
      ['leave_applications', 'employee_id'],
      ['leave_balances', 'employee_id'],
      ['notifications', 'recipient_id'],
      ['profile_edit_requests', 'employee_id'],
      ['push_subscriptions', 'employee_id'],
      ['attendance_regularization_requests', 'employee_id'],
      ['location_snapshots', 'employee_id'],
    ]

    for (const [table, column] of ownedTables) {
      const { error } = await supabase.from(table).delete().eq(column, employee_id)
      if (error) {
        console.error(`Failed to delete ${table}:`, error)
        return err('INTERNAL_ERROR', `Failed to delete ${table}: ${error.message}`, 500)
      }
    }

    const { error: deleteError } = await supabase
      .from('employees')
      .delete()
      .eq('id', employee_id)

    if (deleteError) {
      console.error('Failed to delete employee:', deleteError)
      return err('INTERNAL_ERROR', `Failed to delete employee: ${deleteError.message}`, 500)
    }

    if (employee.auth_id) {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(employee.auth_id)
      if (authDeleteError) {
        console.error('Failed to delete auth user (non-fatal):', authDeleteError)
      }
    }

    if (storagePaths.length > 0) {
      try {
        await supabase.storage.from('employee-documents').remove(storagePaths)
      } catch (storageErr) {
        console.error('Storage cleanup failed (non-fatal):', storageErr)
      }
    }

    return ok({
      deleted: true,
      employee_id: employee.id,
      employee_code: employee.employee_code,
      deleted_by: actor.actorId,
    })
  } catch (e) {
    return handleError(e)
  }
})
