-- Allow employees to withdraw their own pending regularization requests
-- Must be run after 0024_withdraw_regularization.sql which adds 'withdrawn' to the enum

create policy attendance_regularization_requests_withdraw
  on attendance_regularization_requests
  for update
  using (
    get_my_role() in ('owner', 'hr')
    or (
      employee_id = get_my_employee_id()
      and status = 'pending'
    )
  )
  with check (
    get_my_role() in ('owner', 'hr')
    or (
      employee_id = get_my_employee_id()
      and status = 'withdrawn'
    )
  );
