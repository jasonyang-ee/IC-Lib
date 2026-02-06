-- Migration 013: Add user tracking to activity_log
-- Adds user_id column so we can track WHO performed each action

-- Add user_id column to activity_log
ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Index for user-based queries
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);

-- Record migration
INSERT INTO schema_version (version, description)
VALUES (13, 'Add user_id to activity_log for user tracking')
ON CONFLICT (version) DO NOTHING;
