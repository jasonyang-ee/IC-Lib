-- Migration: Fix SMTP settings table for PostgreSQL 18+ compatibility
-- This migration updates the smtp_settings table to use uuidv7() and removes created_at

-- Check if smtp_settings table exists
DO $$
BEGIN
    -- Drop the table if it exists (since it's a singleton, we can recreate it)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'smtp_settings') THEN
        -- Check if the table uses uuid_generate_v4 (old schema)
        -- We need to recreate it with uuidv7()
        
        -- First, backup any existing settings
        CREATE TEMP TABLE IF NOT EXISTS smtp_settings_backup AS 
        SELECT * FROM smtp_settings;
        
        -- Drop the old table
        DROP TABLE IF EXISTS smtp_settings CASCADE;
        
        -- Create the new table with uuidv7()
        CREATE TABLE smtp_settings (
            id UUID PRIMARY KEY DEFAULT uuidv7(),
            host VARCHAR(255) NOT NULL,
            port INTEGER NOT NULL DEFAULT 587,
            secure BOOLEAN DEFAULT false,
            no_auth BOOLEAN DEFAULT false,
            auth_user VARCHAR(255),
            auth_password_encrypted TEXT,
            from_address VARCHAR(255) NOT NULL,
            from_name VARCHAR(100) DEFAULT 'IC Library System',
            enabled BOOLEAN DEFAULT false,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by INTEGER REFERENCES users(id)
        );
        
        -- Recreate the singleton index
        CREATE UNIQUE INDEX idx_smtp_settings_singleton ON smtp_settings((1));
        
        -- Recreate the trigger
        CREATE TRIGGER update_smtp_settings_updated_at
            BEFORE UPDATE ON smtp_settings
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        
        -- Restore any existing settings
        INSERT INTO smtp_settings (host, port, secure, no_auth, auth_user, auth_password_encrypted, from_address, from_name, enabled, updated_at, updated_by)
        SELECT host, port, secure, no_auth, auth_user, auth_password_encrypted, from_address, from_name, enabled, updated_at, updated_by
        FROM smtp_settings_backup
        ON CONFLICT DO NOTHING;
        
        -- Drop the backup table
        DROP TABLE IF EXISTS smtp_settings_backup;
        
        RAISE NOTICE 'SMTP settings table migrated to uuidv7()';
    ELSE
        -- Create the table fresh if it doesn't exist
        CREATE TABLE smtp_settings (
            id UUID PRIMARY KEY DEFAULT uuidv7(),
            host VARCHAR(255) NOT NULL,
            port INTEGER NOT NULL DEFAULT 587,
            secure BOOLEAN DEFAULT false,
            no_auth BOOLEAN DEFAULT false,
            auth_user VARCHAR(255),
            auth_password_encrypted TEXT,
            from_address VARCHAR(255) NOT NULL,
            from_name VARCHAR(100) DEFAULT 'IC Library System',
            enabled BOOLEAN DEFAULT false,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by INTEGER REFERENCES users(id)
        );
        
        CREATE UNIQUE INDEX idx_smtp_settings_singleton ON smtp_settings((1));
        
        CREATE TRIGGER update_smtp_settings_updated_at
            BEFORE UPDATE ON smtp_settings
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        
        RAISE NOTICE 'SMTP settings table created with uuidv7()';
    END IF;
END $$;

-- Also fix email tables if they use uuid_generate_v4()
DO $$
BEGIN
    -- Fix email_notification_preferences if it exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_notification_preferences') THEN
        -- Check if id column has default with uuid_generate_v4
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'email_notification_preferences' 
            AND column_name = 'id'
            AND column_default LIKE '%uuid_generate_v4%'
        ) THEN
            ALTER TABLE email_notification_preferences 
            ALTER COLUMN id SET DEFAULT uuidv7();
            RAISE NOTICE 'email_notification_preferences id default changed to uuidv7()';
        END IF;
    END IF;
END $$;
