-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('read-only', 'read-write', 'admin')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Activity types table for user actions
CREATE TABLE IF NOT EXISTS activity_types (
  id SERIAL PRIMARY KEY,
  type_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User activity log table (separate from component activity_log)
CREATE TABLE IF NOT EXISTS user_activity_log (
  id SERIAL PRIMARY KEY,
  type_name VARCHAR(50) NOT NULL,
  description TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for user activity log
CREATE INDEX IF NOT EXISTS idx_user_activity_log_type ON user_activity_log(type_name);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created ON user_activity_log(created_at DESC);

-- Insert default admin user
-- Password: admin123 (CHANGE THIS IMMEDIATELY IN PRODUCTION!)
-- This is bcrypt hash for "admin123" with salt rounds 10
INSERT INTO users (username, password_hash, role, is_active) 
VALUES ('admin', '$2a$10$4sJM12kg1BTeko3WljHm/OocI.OG/.1v9MkGTdfOgMBtIdOIfOXKi', 'admin', true)
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;

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
