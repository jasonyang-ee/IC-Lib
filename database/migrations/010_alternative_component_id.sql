-- Migration: Change components_alternative FK from part_number to component_id
-- This simplifies the alternative parts schema by using UUID FK to components.id
-- instead of VARCHAR FK to components.part_number
-- Date: 2026-02-05

-- Step 1: Add new component_id column
ALTER TABLE components_alternative
ADD COLUMN IF NOT EXISTS component_id UUID;

-- Step 2: Populate component_id from existing part_number references
UPDATE components_alternative ca
SET component_id = c.id
FROM components c
WHERE c.part_number = ca.part_number;

-- Step 3: Drop old FK constraint and unique constraint
ALTER TABLE components_alternative
DROP CONSTRAINT IF EXISTS components_alternative_part_number_fkey;

ALTER TABLE components_alternative
DROP CONSTRAINT IF EXISTS components_alternative_part_number_manufacturer_id_manufactu_key;

-- Step 4: Drop old index
DROP INDEX IF EXISTS idx_components_alternative_part_number;

-- Step 5: Drop part_number column
ALTER TABLE components_alternative
DROP COLUMN IF EXISTS part_number;

-- Step 6: Add NOT NULL constraint to component_id
ALTER TABLE components_alternative
ALTER COLUMN component_id SET NOT NULL;

-- Step 7: Add FK constraint on component_id
ALTER TABLE components_alternative
ADD CONSTRAINT components_alternative_component_id_fkey
FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE;

-- Step 8: Add new unique constraint
ALTER TABLE components_alternative
ADD CONSTRAINT components_alternative_component_manufacturer_unique
UNIQUE(component_id, manufacturer_id, manufacturer_pn);

-- Step 9: Create new index
CREATE INDEX IF NOT EXISTS idx_components_alternative_component_id
ON components_alternative(component_id);

-- Step 10: Update alternative_parts view
CREATE OR REPLACE VIEW alternative_parts AS
SELECT
    ca.*,
    m.name AS manufacturer_name
FROM components_alternative ca
LEFT JOIN manufacturers m ON ca.manufacturer_id = m.id;

-- Step 11: Track migration
INSERT INTO schema_version (version, description) VALUES
    ('3.1.0', 'Change components_alternative FK from part_number to component_id UUID')
ON CONFLICT (version) DO NOTHING;
