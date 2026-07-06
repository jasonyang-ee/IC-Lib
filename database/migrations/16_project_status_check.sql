-- Migration 16: enforce projects.status domain (SPEC V33, T16, backprop B17/B18)
-- Target release: next after 1.10.0 (see CHANGELOG.md Unreleased)
-- projects.status was the lone lifecycle column without a CHECK constraint
-- (contrast components.check_approval_status, eco_orders.check_eco_status).
-- Normalize any legacy/phantom value (e.g. the never-writable 'planning' the
-- dashboard used to count) to 'active' BEFORE adding the constraint, so the
-- ALTER cannot fail on existing rows. Mirrored in init-schema.sql for fresh
-- installs.

-- 1. Backfill: collapse NULL and out-of-domain statuses to the default.
UPDATE projects
SET status = 'active'
WHERE status IS NULL
   OR status NOT IN ('active', 'completed', 'archived');

-- 2. Add the CHECK constraint idempotently (Postgres has no ADD CONSTRAINT
--    IF NOT EXISTS for CHECK, so guard on pg_constraint).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_project_status'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT check_project_status
      CHECK (status IN ('active', 'completed', 'archived'));
  END IF;
END $$;
