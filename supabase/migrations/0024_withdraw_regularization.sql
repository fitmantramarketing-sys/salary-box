-- Add 'withdrawn' to the regularization_status enum (standalone, no other statements)
-- This is intentionally kept separate from the RLS policy to avoid
-- "unsafe use of new value" error when ALTER TYPE ... ADD VALUE is in a
-- transaction together with statements that reference the enum type.
-- The RLS policy is in 0025_withdraw_regularization_rls.sql.
do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'withdrawn' and enumtypid = 'regularization_status'::regtype) then
    alter type regularization_status add value 'withdrawn';
  end if;
end
$$;
