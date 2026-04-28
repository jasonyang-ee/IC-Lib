-- Add the lab role as a read-write-equivalent account type with File Library page restrictions enforced in app auth.
DO $$
BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('read-only', 'reviewer', 'lab', 'read-write', 'approver', 'admin'));
END $$;
