-- 0010_fix_enforce_employee_update_service_role.sql
-- Fix: enforce_employee_update and enforce_leave_application_update triggers
-- were blocking service-role client updates.
-- The service-role client has no auth.uid() context, so get_my_role() returns
-- NULL, causing the triggers to always raise 'not permitted'. This prevented
-- Edge Functions (create-employee, update-employee, review-leave, etc.) from
-- modifying employee and leave_application rows.
--
-- Fix: If my_role is NULL (service-role / system context), allow the update.
-- Service-role is already trusted (it has the service_role key).
-- Also applied the immutable field check BEFORE the null check for leave
-- applications — immutable fields should never be changed, even by service-role.

create or replace function enforce_employee_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  my_role user_role := get_my_role();
begin
  -- Service-role / system context (no authenticated user) — allow all updates.
  -- This is safe because the service_role key is only used by Edge Functions
  -- which enforce their own role checks via getActor().
  if my_role is null then
    return new;
  end if;

  if my_role = 'owner' then
    return new;
  end if;

  if my_role = 'hr' then
    if new.role is distinct from old.role
       or new.current_salary is distinct from old.current_salary
       or new.auth_id is distinct from old.auth_id then
      raise exception 'hr cannot modify role, current_salary, or auth_id';
    end if;
    return new;
  end if;

  -- employee updating their own row: only the self-service contact fields
  -- (phone, personal_email, address fields, emergency contact, photo_url)
  -- may change.
  if old.auth_id = auth.uid() then
    if new.id is distinct from old.id
       or new.auth_id is distinct from old.auth_id
       or new.employee_code is distinct from old.employee_code
       or new.first_name is distinct from old.first_name
       or new.last_name is distinct from old.last_name
       or new.email is distinct from old.email
       or new.date_of_birth is distinct from old.date_of_birth
       or new.gender is distinct from old.gender
       or new.department_id is distinct from old.department_id
       or new.designation_id is distinct from old.designation_id
       or new.reporting_manager_id is distinct from old.reporting_manager_id
       or new.role is distinct from old.role
       or new.employment_type is distinct from old.employment_type
       or new.employment_status is distinct from old.employment_status
       or new.join_date is distinct from old.join_date
       or new.exit_date is distinct from old.exit_date
       or new.probation_end_date is distinct from old.probation_end_date
       or new.current_salary is distinct from old.current_salary
       or new.previous_employee_id is distinct from old.previous_employee_id
       or new.is_first_login is distinct from old.is_first_login
       or new.is_active is distinct from old.is_active
       or new.created_at is distinct from old.created_at
       or new.created_by is distinct from old.created_by
    then
      raise exception 'employees may only update their own contact fields';
    end if;
    return new;
  end if;

  raise exception 'not permitted to update this employee row';
end;
$$;

-- Same fix for enforce_leave_application_update.
-- Note: immutable field check is BEFORE the null check — those fields
-- should never be modified, even by service-role Edge Functions.
create or replace function enforce_leave_application_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  my_role user_role := get_my_role();
begin
  if new.employee_id is distinct from old.employee_id
     or new.leave_type_id is distinct from old.leave_type_id
     or new.from_date is distinct from old.from_date
     or new.to_date is distinct from old.to_date
     or new.working_days_count is distinct from old.working_days_count
     or new.applied_at is distinct from old.applied_at
  then
    raise exception 'employee_id, leave_type_id, from_date, to_date, working_days_count and applied_at are immutable';
  end if;

  -- Service-role / system context — allow all updates (except immutables above).
  if my_role is null then
    return new;
  end if;

  if my_role = 'owner' then
    return new;
  end if;

  if my_role = 'hr' then
    if old.status = 'pending' and new.status in ('approved', 'rejected') then
      return new;
    end if;
    if old.status = 'approved' and old.cancellation_requested = true and new.status = 'cancelled' then
      return new;
    end if;
    raise exception 'hr may only approve/reject a pending application or confirm a requested cancellation';
  end if;

  if old.employee_id = get_my_employee_id() then
    if old.status = 'pending' and new.status = 'cancelled' then
      return new;
    end if;
    if old.status = 'approved' and new.status = 'approved'
       and old.cancellation_requested = false and new.cancellation_requested = true
       and new.cancellation_requested_at is not null then
      return new;
    end if;
    raise exception 'employees may only cancel a pending application or request cancellation of an approved application';
  end if;

  raise exception 'not permitted to update this leave application';
end;
$$;
