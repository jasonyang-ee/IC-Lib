-- Add document control notification target for approved ECO PDF delivery.
ALTER TABLE admin_settings
    ADD COLUMN IF NOT EXISTS eco_complete_notification_email VARCHAR(255) DEFAULT '';