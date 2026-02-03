-- Migration: 001_major_schema_update.sql
-- Date: 2025-01-20
-- Description: Major schema update including:
--   - Change component_categories to use UUID primary key
--   - Add sub_category4 to components
--   - Remove status and notes from components
--   - Clean up activity_log to use details JSONB
--   - Update all UUIDs to use uuidv7() default
--   - Add created_at() helper function
--   - Clean up indexes

-- =====================================================
-- STEP 1: Add helper function for extracting timestamp from uuidv7
-- =====================================================
CREATE OR REPLACE FUNCTION created_at(uuid_value UUID) 
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  -- Extract timestamp from UUIDv7 (first 48 bits are Unix milliseconds)
  RETURN to_timestamp(
    ('x' || lpad(replace(uuid_value::text, '-', ''), 16, '0'))::bit(48)::bigint / 1000.0
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- STEP 2: Add sub_category4 to components table
-- =====================================================
ALTER TABLE components ADD COLUMN IF NOT EXISTS sub_category4 VARCHAR(100);

-- =====================================================
-- STEP 3: Remove status and notes columns from components
-- =====================================================
-- First drop any indexes that reference these columns
DROP INDEX IF EXISTS idx_components_status;

-- Remove the columns
ALTER TABLE components DROP COLUMN IF EXISTS status;
ALTER TABLE components DROP COLUMN IF EXISTS notes;

-- =====================================================
-- STEP 4: Update activity_log table structure
-- =====================================================
-- Add new details column if it doesn't exist
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS details JSONB;

-- Migrate existing data from old columns to details JSONB
UPDATE activity_log 
SET details = jsonb_build_object(
  'description', description,
  'category_name', category_name,
  'change_details', change_details
)
WHERE details IS NULL 
  AND (description IS NOT NULL OR category_name IS NOT NULL OR change_details IS NOT NULL);

-- Drop old columns from activity_log
ALTER TABLE activity_log DROP COLUMN IF EXISTS description;
ALTER TABLE activity_log DROP COLUMN IF EXISTS category_name;
ALTER TABLE activity_log DROP COLUMN IF EXISTS change_details;

-- Drop created_at column as we'll extract it from uuidv7 id
ALTER TABLE activity_log DROP COLUMN IF EXISTS created_at;

-- =====================================================
-- STEP 5: Update category_id from SERIAL to UUID
-- =====================================================
-- This is a complex migration that requires recreating the table
-- We need to:
-- 1. Create a mapping table for old integer IDs to new UUIDs
-- 2. Add new UUID columns to referencing tables
-- 3. Populate the new columns
-- 4. Drop old columns and rename new columns

-- Create temporary mapping table
CREATE TEMP TABLE category_id_mapping (
  old_id INTEGER PRIMARY KEY,
  new_id UUID DEFAULT uuidv7()
);

-- Populate mapping with existing category IDs
INSERT INTO category_id_mapping (old_id)
SELECT id FROM component_categories;

-- Add new UUID column to component_categories
ALTER TABLE component_categories ADD COLUMN new_id UUID;

-- Populate new_id from mapping
UPDATE component_categories cc
SET new_id = m.new_id
FROM category_id_mapping m
WHERE cc.id = m.old_id;

-- Add new UUID column to components for category reference
ALTER TABLE components ADD COLUMN new_category_id UUID;

-- Populate new_category_id from mapping
UPDATE components c
SET new_category_id = m.new_id
FROM category_id_mapping m
WHERE c.category_id = m.old_id;

-- Add new UUID column to category_specifications for category reference
ALTER TABLE category_specifications ADD COLUMN new_category_id UUID;

-- Populate new_category_id for category_specifications
UPDATE category_specifications cs
SET new_category_id = m.new_id
FROM category_id_mapping m
WHERE cs.category_id = m.old_id;

-- Drop old foreign key constraints
ALTER TABLE components DROP CONSTRAINT IF EXISTS components_category_id_fkey;
ALTER TABLE category_specifications DROP CONSTRAINT IF EXISTS category_specifications_category_id_fkey;

-- Drop old primary key and indexes on component_categories
ALTER TABLE component_categories DROP CONSTRAINT IF EXISTS component_categories_pkey;
DROP INDEX IF EXISTS idx_category_name;

-- Drop old category_id columns
ALTER TABLE components DROP COLUMN category_id;
ALTER TABLE component_categories DROP COLUMN id;
ALTER TABLE category_specifications DROP COLUMN category_id;

-- Rename new columns
ALTER TABLE component_categories RENAME COLUMN new_id TO id;
ALTER TABLE components RENAME COLUMN new_category_id TO category_id;
ALTER TABLE category_specifications RENAME COLUMN new_category_id TO category_id;

-- Add primary key constraint to new id column
ALTER TABLE component_categories ADD PRIMARY KEY (id);

-- Add NOT NULL constraint after population
ALTER TABLE component_categories ALTER COLUMN id SET NOT NULL;
ALTER TABLE component_categories ALTER COLUMN id SET DEFAULT uuidv7();

-- Re-add foreign key constraints
ALTER TABLE components ADD CONSTRAINT components_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES component_categories(id) ON DELETE SET NULL;

ALTER TABLE category_specifications ADD CONSTRAINT category_specifications_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES component_categories(id) ON DELETE CASCADE;

-- Recreate unique index on category name
CREATE UNIQUE INDEX idx_category_name ON component_categories(name);

-- =====================================================
-- STEP 6: Update get_part_type function for sub_category4
-- =====================================================
CREATE OR REPLACE FUNCTION get_part_type(
  cat_name VARCHAR, 
  sub1 VARCHAR, 
  sub2 VARCHAR, 
  sub3 VARCHAR,
  sub4 VARCHAR DEFAULT NULL
) RETURNS VARCHAR AS $$
BEGIN
  RETURN CONCAT_WS('\', 
    cat_name,
    NULLIF(sub1, ''),
    NULLIF(sub2, ''),
    NULLIF(sub3, ''),
    NULLIF(sub4, '')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- STEP 7: Clean up indexes - remove redundant ones
-- =====================================================
-- Drop redundant single-column indexes that are covered by composite indexes
DROP INDEX IF EXISTS idx_components_created_at;

-- Add efficient index on category_id
CREATE INDEX IF NOT EXISTS idx_components_category ON components(category_id);

-- Add GIN index on details for activity_log
CREATE INDEX IF NOT EXISTS idx_activity_log_details ON activity_log USING GIN (details);

-- =====================================================
-- STEP 8: Ensure all UUIDs use uuidv7() default
-- =====================================================
-- These ALTER statements ensure the defaults are set correctly
ALTER TABLE components ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE manufacturers ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE distributors ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE distributor_info ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE inventory ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE projects ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE project_components ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE users ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE eco_orders ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE eco_changes ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE eco_distributors ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE eco_alternative_parts ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE eco_specifications ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE activity_log ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE components_alternative ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE inventory_alternative ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE category_specifications ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE component_specification_values ALTER COLUMN id SET DEFAULT uuidv7();

-- Clean up temporary table
DROP TABLE IF EXISTS category_id_mapping;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
