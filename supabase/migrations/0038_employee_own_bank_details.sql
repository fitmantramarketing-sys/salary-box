-- Allow employees to enter/edit their OWN bank details (self-service).
-- Owner keeps full access; employees can only touch their own row.

drop policy if exists employee_bank_details_insert on employee_bank_details;
drop policy if exists employee_bank_details_update on employee_bank_details;

create policy employee_bank_details_insert on employee_bank_details
  for insert
  with check (
    get_my_role() = 'owner'
    or employee_id = get_my_employee_id()
  );

create policy employee_bank_details_update on employee_bank_details
  for update
  using (
    get_my_role() = 'owner'
    or employee_id = get_my_employee_id()
  )
  with check (
    get_my_role() = 'owner'
    or employee_id = get_my_employee_id()
  );