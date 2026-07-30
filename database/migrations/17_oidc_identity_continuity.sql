-- Migration 17: OIDC continuity identity on users (SPEC §V29)
-- Target release: next after 1.10.0 (see CHANGELOG.md Unreleased)
-- Entra object identity is stable across client registrations within a tenant.
-- Keep it optional so standards-compliant generic OIDC providers need only
-- the primary (oidc_issuer, oidc_sub) identity.

ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_tenant_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_object_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_oidc_continuity_identity_unique
  ON users(oidc_issuer, oidc_tenant_id, oidc_object_id)
  WHERE oidc_issuer IS NOT NULL
    AND oidc_tenant_id IS NOT NULL
    AND oidc_object_id IS NOT NULL;
