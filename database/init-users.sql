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

-- Insert default admin user
-- Password: admin123 (CHANGE THIS IMMEDIATELY IN PRODUCTION!)
-- This is bcrypt hash for "admin123" with salt rounds 10
INSERT INTO users (username, password_hash, role, is_active) 
VALUES ('admin', '$2a$10$4sJM12kg1BTeko3WljHm/OocI.OG/.1v9MkGTdfOgMBtIdOIfOXKi', 'admin', true)
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Add activity tracking for user management (only if activity_types table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'activity_types') THEN
    INSERT INTO activity_types (type_name, description) 
    VALUES 
      ('user_created', 'New user account created'),
      ('user_updated', 'User account updated'),
      ('user_deleted', 'User account deleted'),
      ('user_login', 'User logged in'),
      ('user_logout', 'User logged out')
    ON CONFLICT (type_name) DO NOTHING;
  END IF;
END $$;
