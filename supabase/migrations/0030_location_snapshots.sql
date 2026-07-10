-- Location snapshots: record every check-in/check-out GPS attempt
-- regardless of whether the geofence check passed or failed.

create table if not exists location_snapshots (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  action text not null check (action in ('check_in', 'check_out')),
  latitude numeric(10,7),
  longitude numeric(10,7),
  inside_geofence boolean,
  ip inet,
  successful boolean not null default false,
  attendance_record_id uuid references attendance_records(id),
  error_code text,
  created_at timestamptz not null default now()
);

alter table location_snapshots enable row level security;

-- Owner/HR can see all snapshots
create policy "location_snapshots_select_owner_hr"
  on location_snapshots for select
  using (get_my_role() in ('owner', 'hr'));

-- Employees can see their own snapshots
create policy "location_snapshots_select_employee"
  on location_snapshots for select
  using (employee_id = get_my_employee_id());
