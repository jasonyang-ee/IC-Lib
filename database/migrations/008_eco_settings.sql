-- Migration: Add ECO settings table and update generate_eco_number function
-- Date: 2025-01-XX

-- Create eco_settings table for configurable ECO number generation
CREATE TABLE IF NOT EXISTS eco_settings (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    prefix VARCHAR(20) DEFAULT 'ECO-',
    leading_zeros INTEGER DEFAULT 6,
    next_number INTEGER DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings if not exists
INSERT INTO eco_settings (prefix, leading_zeros, next_number)
SELECT 'ECO-', 6, COALESCE(
    (SELECT MAX(CAST(SUBSTRING(eco_number FROM 5) AS INTEGER)) + 1 FROM eco_orders WHERE eco_number ~ '^ECO-[0-9]+$'),
    1
)
WHERE NOT EXISTS (SELECT 1 FROM eco_settings);

-- Update the generate_eco_number function to use settings table
CREATE OR REPLACE FUNCTION generate_eco_number()
RETURNS VARCHAR AS $$
DECLARE
    settings_rec RECORD;
    eco_num VARCHAR(50);
BEGIN
    -- Get current settings
    SELECT prefix, leading_zeros, next_number INTO settings_rec
    FROM eco_settings
    LIMIT 1;
    
    -- If no settings exist, use defaults
    IF settings_rec IS NULL THEN
        INSERT INTO eco_settings (prefix, leading_zeros, next_number)
        VALUES ('ECO-', 6, 1)
        RETURNING prefix, leading_zeros, next_number INTO settings_rec;
    END IF;
    
    -- Format ECO number with prefix and leading zeros
    eco_num := settings_rec.prefix || LPAD(settings_rec.next_number::TEXT, settings_rec.leading_zeros, '0');
    
    -- Increment next_number for future ECOs
    UPDATE eco_settings SET next_number = next_number + 1, updated_at = CURRENT_TIMESTAMP;
    
    RETURN eco_num;
END;
$$ LANGUAGE plpgsql;
