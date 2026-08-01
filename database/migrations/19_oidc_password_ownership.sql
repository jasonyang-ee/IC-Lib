-- Migration 19: enforce SSO credential ownership (SPEC V29, V50)
-- Target release: next after 1.10.0 (see CHANGELOG.md Unreleased)
-- This purge is irreversible: existing OIDC password hashes become NULL.

UPDATE users
SET password_hash = NULL
WHERE auth_provider = 'oidc' AND password_hash IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_oidc_password_ownership'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_oidc_password_ownership
      CHECK (auth_provider <> 'oidc' OR password_hash IS NULL);
  END IF;
END $$;
