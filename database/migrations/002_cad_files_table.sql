-- Migration 002: Create cad_files tracking table
-- This table tracks all CAD files with UUID for indexing, orphan detection,
-- and many-to-many relationships between components and CAD files.
--
-- Run this migration after 001_cad_columns_to_jsonb.sql

-- ============================================================================
-- STEP 1: Create cad_files table
-- ============================================================================
CREATE TABLE IF NOT EXISTS cad_files (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(1000),
    file_size BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_file_type CHECK (file_type IN ('footprint', 'symbol', 'model', 'pspice', 'pad')),
    CONSTRAINT uq_cad_file UNIQUE (file_name, file_type)
);

-- ============================================================================
-- STEP 2: Create component_cad_files junction table
-- ============================================================================
CREATE TABLE IF NOT EXISTS component_cad_files (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    cad_file_id UUID NOT NULL REFERENCES cad_files(id) ON DELETE CASCADE,
    CONSTRAINT uq_component_cad_file UNIQUE (component_id, cad_file_id)
);

-- ============================================================================
-- STEP 3: Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_cad_files_file_type ON cad_files(file_type);
CREATE INDEX IF NOT EXISTS idx_cad_files_file_name ON cad_files(file_name);
CREATE INDEX IF NOT EXISTS idx_component_cad_files_component ON component_cad_files(component_id);
CREATE INDEX IF NOT EXISTS idx_component_cad_files_cad_file ON component_cad_files(cad_file_id);

-- ============================================================================
-- STEP 4: Migrate existing JSONB data to the new tables
-- ============================================================================

-- Migrate pcb_footprint entries
INSERT INTO cad_files (file_name, file_type)
SELECT DISTINCT f, 'footprint'
FROM components, jsonb_array_elements_text(pcb_footprint) AS f
WHERE pcb_footprint IS NOT NULL AND pcb_footprint != '[]'::jsonb
ON CONFLICT (file_name, file_type) DO NOTHING;

-- Migrate schematic entries
INSERT INTO cad_files (file_name, file_type)
SELECT DISTINCT f, 'symbol'
FROM components, jsonb_array_elements_text(schematic) AS f
WHERE schematic IS NOT NULL AND schematic != '[]'::jsonb
ON CONFLICT (file_name, file_type) DO NOTHING;

-- Migrate step_model entries
INSERT INTO cad_files (file_name, file_type)
SELECT DISTINCT f, 'model'
FROM components, jsonb_array_elements_text(step_model) AS f
WHERE step_model IS NOT NULL AND step_model != '[]'::jsonb
ON CONFLICT (file_name, file_type) DO NOTHING;

-- Migrate pspice entries
INSERT INTO cad_files (file_name, file_type)
SELECT DISTINCT f, 'pspice'
FROM components, jsonb_array_elements_text(pspice) AS f
WHERE pspice IS NOT NULL AND pspice != '[]'::jsonb
ON CONFLICT (file_name, file_type) DO NOTHING;

-- Migrate pad_file entries
INSERT INTO cad_files (file_name, file_type)
SELECT DISTINCT f, 'pad'
FROM components, jsonb_array_elements_text(pad_file) AS f
WHERE pad_file IS NOT NULL AND pad_file != '[]'::jsonb
ON CONFLICT (file_name, file_type) DO NOTHING;

-- Create junction table entries for footprints
INSERT INTO component_cad_files (component_id, cad_file_id)
SELECT c.id, cf.id
FROM components c, jsonb_array_elements_text(c.pcb_footprint) AS f
JOIN cad_files cf ON cf.file_name = f AND cf.file_type = 'footprint'
WHERE c.pcb_footprint IS NOT NULL AND c.pcb_footprint != '[]'::jsonb
ON CONFLICT (component_id, cad_file_id) DO NOTHING;

-- Create junction table entries for schematics
INSERT INTO component_cad_files (component_id, cad_file_id)
SELECT c.id, cf.id
FROM components c, jsonb_array_elements_text(c.schematic) AS f
JOIN cad_files cf ON cf.file_name = f AND cf.file_type = 'symbol'
WHERE c.schematic IS NOT NULL AND c.schematic != '[]'::jsonb
ON CONFLICT (component_id, cad_file_id) DO NOTHING;

-- Create junction table entries for step models
INSERT INTO component_cad_files (component_id, cad_file_id)
SELECT c.id, cf.id
FROM components c, jsonb_array_elements_text(c.step_model) AS f
JOIN cad_files cf ON cf.file_name = f AND cf.file_type = 'model'
WHERE c.step_model IS NOT NULL AND c.step_model != '[]'::jsonb
ON CONFLICT (component_id, cad_file_id) DO NOTHING;

-- Create junction table entries for pspice
INSERT INTO component_cad_files (component_id, cad_file_id)
SELECT c.id, cf.id
FROM components c, jsonb_array_elements_text(c.pspice) AS f
JOIN cad_files cf ON cf.file_name = f AND cf.file_type = 'pspice'
WHERE c.pspice IS NOT NULL AND c.pspice != '[]'::jsonb
ON CONFLICT (component_id, cad_file_id) DO NOTHING;

-- Create junction table entries for pad files
INSERT INTO component_cad_files (component_id, cad_file_id)
SELECT c.id, cf.id
FROM components c, jsonb_array_elements_text(c.pad_file) AS f
JOIN cad_files cf ON cf.file_name = f AND cf.file_type = 'pad'
WHERE c.pad_file IS NOT NULL AND c.pad_file != '[]'::jsonb
ON CONFLICT (component_id, cad_file_id) DO NOTHING;
