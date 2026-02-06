-- Migration: Add pad_file column to components table
-- Pad files are important CAD files that were not previously tracked in the database
-- Date: 2026-02-05

-- Add pad_file column to components table
ALTER TABLE components
ADD COLUMN IF NOT EXISTS pad_file VARCHAR(255);

-- Track migration
INSERT INTO schema_version (version, description) VALUES
    ('3.2.0', 'Add pad_file column to components table')
ON CONFLICT (version) DO NOTHING;
