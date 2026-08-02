-- Users table for authentication
-- password_hash is NULLable: SSO-only (OIDC) users carry no local password
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('read-only', 'reviewer', 'lab', 'read-write', 'approver', 'admin')),
  email VARCHAR(255),
  display_name VARCHAR(100),
  notification_preferences JSONB DEFAULT '{
    "eco_submitted": false,
    "eco_approved": false,
    "eco_rejected": false,
    "eco_assigned": false
  }'::jsonb,
  file_storage_path VARCHAR(1000),
  delegation UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id),
  last_login TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auth_provider VARCHAR(20) NOT NULL DEFAULT 'local',
  oidc_issuer TEXT,
  oidc_sub TEXT,
  oidc_tenant_id TEXT,
  oidc_object_id TEXT,
  CONSTRAINT users_oidc_password_ownership
    CHECK (auth_provider <> 'oidc' OR password_hash IS NULL)
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by);
CREATE INDEX IF NOT EXISTS idx_users_delegation ON users(delegation);
-- A federated identity is uniquely identified by (issuer, sub)
CREATE UNIQUE INDEX IF NOT EXISTS users_oidc_identity_unique
  ON users(oidc_issuer, oidc_sub)
  WHERE oidc_issuer IS NOT NULL AND oidc_sub IS NOT NULL;
-- Optional continuity identity supports OIDC providers that emit tenant/object ids
CREATE UNIQUE INDEX IF NOT EXISTS users_oidc_continuity_identity_unique
  ON users(oidc_issuer, oidc_tenant_id, oidc_object_id)
  WHERE oidc_issuer IS NOT NULL
    AND oidc_tenant_id IS NOT NULL
    AND oidc_object_id IS NOT NULL;

-- Activity types table for user actions
CREATE TABLE IF NOT EXISTS activity_types (
  id SERIAL PRIMARY KEY,
  type_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT
);

-- User activity log table (separate from component activity_log)
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  type_name VARCHAR(50) NOT NULL,
  description TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for user activity log
CREATE INDEX IF NOT EXISTS idx_user_activity_log_type ON user_activity_log(type_name);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_id ON user_activity_log(id DESC);

-- Insert default admin user
-- Password: admin123 (CHANGE THIS IMMEDIATELY IN PRODUCTION!)
-- This is bcrypt hash for "admin123" with salt rounds 10
INSERT INTO users (username, password_hash, role, display_name, is_active)
VALUES ('admin', '$2a$10$4sJM12kg1BTeko3WljHm/OocI.OG/.1v9MkGTdfOgMBtIdOIfOXKi', 'admin', 'Administrator', true)
ON CONFLICT (username) DO UPDATE
SET password_hash = CASE
  WHEN users.auth_provider = 'local' THEN EXCLUDED.password_hash
  ELSE users.password_hash
END;

-- Insert default guest user
-- Password: guest123 (Read-only access for viewing)
-- This is bcrypt hash for "guest123" with salt rounds 10
INSERT INTO users (username, password_hash, role, display_name, is_active)
VALUES ('guest', '$2a$10$G8viUMs5vl8vvm6EOLaoFutUTyqabBRcLYB4c8TcmDBe7mAmxQyra', 'read-only', 'Guest User', true)
ON CONFLICT (username) DO UPDATE
SET password_hash = CASE
      WHEN users.auth_provider = 'local' THEN EXCLUDED.password_hash
      ELSE users.password_hash
    END,
    role = 'read-only';

-- Add activity types for user management
INSERT INTO activity_types (type_name, description)
VALUES
  ('user_created', 'New user account created'),
  ('user_updated', 'User account updated'),
  ('user_deleted', 'User account deleted'),
  ('user_login', 'User logged in'),
  ('user_logout', 'User logged out'),
  ('password_changed', 'User password changed')
ON CONFLICT (type_name) DO NOTHING;
