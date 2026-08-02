-- Migration 20: repair auth-state and OIDC credential constraints (SPEC V1, V29)
-- Target release: next after 1.10.0 (see CHANGELOG.md Unreleased)

UPDATE users
SET is_active = false
WHERE is_active IS NULL;

ALTER TABLE users ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE users ALTER COLUMN is_active SET NOT NULL;

UPDATE users
SET password_hash = NULL
WHERE auth_provider = 'oidc' AND password_hash IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND conname = 'users_oidc_password_ownership'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_oidc_password_ownership
      CHECK (auth_provider <> 'oidc' OR password_hash IS NULL);
  END IF;
END $$;
