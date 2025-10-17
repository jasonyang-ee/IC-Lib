-- Migration Script: Add User Activity Logging Tables
-- Run this on existing IC-Lib databases to fix activity log errors
-- Date: 2025-10-17

-- Step 1: Create activity_types table
CREATE TABLE IF NOT EXISTS activity_types (
  id SERIAL PRIMARY KEY,
  type_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE activity_types IS 'Defines types of user activities that can be logged';

-- Step 2: Create user_activity_log table
CREATE TABLE IF NOT EXISTS user_activity_log (
  id SERIAL PRIMARY KEY,
  type_name VARCHAR(50) NOT NULL,
  description TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE user_activity_log IS 'Logs user authentication and management activities (separate from component activity_log)';

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_activity_log_type ON user_activity_log(type_name);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created ON user_activity_log(created_at DESC);

-- Step 4: Insert default activity types
INSERT INTO activity_types (type_name, description) 
VALUES 
  ('user_created', 'New user account created'),
  ('user_updated', 'User account updated'),
  ('user_deleted', 'User account deleted'),
  ('user_login', 'User logged in'),
  ('user_logout', 'User logged out'),
  ('password_changed', 'User password changed')
ON CONFLICT (type_name) DO NOTHING;

-- Step 5: Verify migration
DO $$
DECLARE
  activity_types_count INTEGER;
  user_activity_log_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO activity_types_count FROM activity_types;
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'user_activity_log'
  ) INTO user_activity_log_exists;
  
  IF user_activity_log_exists AND activity_types_count >= 6 THEN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '   - activity_types table created with % entries', activity_types_count;
    RAISE NOTICE '   - user_activity_log table created';
    RAISE NOTICE '   - Indexes created';
  ELSE
    RAISE WARNING '⚠️  Migration may be incomplete. Please check tables manually.';
  END IF;
END $$;
