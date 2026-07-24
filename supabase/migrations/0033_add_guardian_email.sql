ALTER TABLE employees
ADD COLUMN guardian_email text;

COMMENT ON COLUMN employees.guardian_email IS 'Email address of the employee''s guardian/emergency contact';
