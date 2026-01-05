-- Migration: Add user profile fields for email, display name, and notification preferences
-- Date: 2025-01-01
-- Description: Adds email, display_name, and notification_preferences columns to users table

-- Add email column (optional, for SMTP notifications)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add display name column (for user-friendly display)
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

-- Add notification preferences as JSONB (flexible for future expansion)
-- Default preferences:
-- {
--   "eco_submitted": true,        -- Notify when ECO is submitted for approval
--   "eco_approved": true,         -- Notify when ECO is approved
--   "eco_rejected": true,         -- Notify when ECO is rejected
--   "eco_assigned": true,         -- Notify when assigned as ECO approver
--   "component_updated": false,   -- Notify when component is updated
--   "low_stock": false            -- Notify when inventory is low
-- }
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "eco_submitted": true,
  "eco_approved": true,
  "eco_rejected": true,
  "eco_assigned": true,
  "component_updated": false,
  "low_stock": false
}'::jsonb;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Update activity types for profile changes
INSERT INTO activity_types (type_name, description) 
VALUES 
  ('profile_updated', 'User profile information updated'),
  ('notification_preferences_updated', 'User notification preferences updated'),
  ('email_updated', 'User email address updated')
ON CONFLICT (type_name) DO NOTHING;

-- Add comment for documentation
COMMENT ON COLUMN users.email IS 'Optional email address for SMTP notifications';
COMMENT ON COLUMN users.display_name IS 'User-friendly display name';
COMMENT ON COLUMN users.notification_preferences IS 'JSONB object containing notification preferences';
