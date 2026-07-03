-- Migration 15: OIDC/SSO federated identities on users (SPEC V29, T11)
-- Target release: next after 1.10.0 (see CHANGELOG.md Unreleased)
-- SSO-only users carry no local password; a federated identity is uniquely
-- identified by (oidc_issuer, oidc_sub). Mirrored in init-users.sql for
-- fresh installs.

-- SSO-only users have no local password hash (local login rejects NULL hash)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_issuer TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_oidc_identity_unique
  ON users(oidc_issuer, oidc_sub)
  WHERE oidc_issuer IS NOT NULL AND oidc_sub IS NOT NULL;
