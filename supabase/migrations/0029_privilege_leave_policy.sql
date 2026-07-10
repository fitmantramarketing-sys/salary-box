-- Privilege Leave Policy: single PL type with monthly cap + LWP fallback

-- 1. Monthly cap per leave type
alter table leave_types add column if not exists max_per_month smallint;

-- 2. Track how many days in an application are unpaid
alter table leave_applications add column if not exists lwp_days numeric(4,2) not null default 0;

-- 3. Per-employee yearly allocation (for manual-accrual types like PL)
alter table leave_balances add column if not exists annual_allocation numeric(5,2) not null default 0;

-- 4. Seed PL (Privilege Leave) and LWP (Leave Without Pay)
insert into leave_types (name, code, accrual_type, max_per_month, max_carry_forward_days, is_lwp, min_notice_days)
values
  ('Privilege Leave', 'PL', 'manual', 2, 0, false, 1),
  ('Leave Without Pay', 'LWP', 'manual', null, 0, true, 0)
on conflict (code) do nothing;

-- 5. Make LWP visible to employees too (existing RLS on leave_types requires
--    owner/hr/system_admin to see all, but employees only see active = true —
--    which includes both PL and LWP since both are active).
--    No change needed: the existing policy `leave_types_select` already allows
--    employees to see leave types where `is_active = true`.
