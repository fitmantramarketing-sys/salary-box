-- Allow employees to set is_first_login = false during password setup.
-- The previous trigger blocked self-updates of is_first_login because it was
-- included in the list of restricted fields alongside role, salary, auth_id, etc.
-- However, toggling is_first_login from true to false is a necessary part of the
-- first-login flow and carries no security risk (it can only be set to false,
-- and re-setting it to true would just redirect the user to the set-password page).

create or replace function enforce_employee_update()
returns trigger
language plpgsql
as $$
declare
  my_role user_role := get_my_role();
begin
  -- Service-role / system context (no authenticated user) — allow all updates.
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
  -- may change, plus is_first_login (for the set-password flow).
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
