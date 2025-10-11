-- Migration: Add change_details column to activity_log table
-- Date: 2025-10-11
-- Purpose: Support inventory operation tracking with detailed change information

-- Add change_details column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'activity_log' 
        AND column_name = 'change_details'
    ) THEN
        ALTER TABLE activity_log ADD COLUMN change_details JSONB;
        RAISE NOTICE 'Added change_details column to activity_log table';
    ELSE
        RAISE NOTICE 'change_details column already exists in activity_log table';
    END IF;
END $$;

-- Update activity_type comment to include new types
COMMENT ON COLUMN activity_log.activity_type IS 'Type of activity: added, updated, deleted, inventory_updated, inventory_consumed, location_updated';

-- Verify the change
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'activity_log'
ORDER BY ordinal_position;
