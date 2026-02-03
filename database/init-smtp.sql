-- ============================================================================
-- SMTP Configuration Table
-- Stores email server settings for sending notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS smtp_settings (
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

-- Only one SMTP configuration should exist at a time (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_smtp_settings_singleton ON smtp_settings((1));

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_smtp_settings_updated_at
    BEFORE UPDATE ON smtp_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE smtp_settings IS 'SMTP server configuration for sending email notifications';
COMMENT ON COLUMN smtp_settings.auth_password_encrypted IS 'Encrypted SMTP password (AES-256-CBC encryption)';
COMMENT ON COLUMN smtp_settings.no_auth IS 'Set to true for SMTP servers that do not require authentication';

-- ============================================================================
-- Email Notification Preferences Table
-- Stores user preferences for email notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  notify_eco_created BOOLEAN DEFAULT true,
  notify_eco_approved BOOLEAN DEFAULT true,
  notify_eco_rejected BOOLEAN DEFAULT true,
  notify_eco_pending_approval BOOLEAN DEFAULT true, -- For approvers only
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_email_prefs_updated_at
    BEFORE UPDATE ON email_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Email Log Table (optional - for tracking sent emails)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_log (
  id SERIAL PRIMARY KEY,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  template_name VARCHAR(100),
  status VARCHAR(50) NOT NULL, -- 'sent', 'failed', 'queued'
  error_message TEXT,
  eco_id UUID REFERENCES eco_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_log_created_at ON email_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_eco ON email_log(eco_id);
