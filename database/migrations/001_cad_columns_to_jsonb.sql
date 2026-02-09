-- Migration: Convert CAD file columns from VARCHAR to JSONB arrays
-- Version: 1.7.0
-- Description: Supports multiple CAD files per type per component

-- Step 1: Add temporary JSONB columns
ALTER TABLE components ADD COLUMN IF NOT EXISTS pcb_footprint_new JSONB DEFAULT '[]'::jsonb;
ALTER TABLE components ADD COLUMN IF NOT EXISTS schematic_new JSONB DEFAULT '[]'::jsonb;
ALTER TABLE components ADD COLUMN IF NOT EXISTS step_model_new JSONB DEFAULT '[]'::jsonb;
ALTER TABLE components ADD COLUMN IF NOT EXISTS pspice_new JSONB DEFAULT '[]'::jsonb;
ALTER TABLE components ADD COLUMN IF NOT EXISTS pad_file_new JSONB DEFAULT '[]'::jsonb;

-- Step 2: Migrate existing data (wrap non-null, non-empty values in JSON arrays)
UPDATE components SET pcb_footprint_new =
  CASE WHEN pcb_footprint IS NOT NULL AND pcb_footprint != '' AND pcb_footprint != 'N/A'
    THEN jsonb_build_array(pcb_footprint)
    ELSE '[]'::jsonb
  END;

UPDATE components SET schematic_new =
  CASE WHEN schematic IS NOT NULL AND schematic != '' AND schematic != 'N/A'
    THEN jsonb_build_array(schematic)
    ELSE '[]'::jsonb
  END;

UPDATE components SET step_model_new =
  CASE WHEN step_model IS NOT NULL AND step_model != '' AND step_model != 'N/A'
    THEN jsonb_build_array(step_model)
    ELSE '[]'::jsonb
  END;

UPDATE components SET pspice_new =
  CASE WHEN pspice IS NOT NULL AND pspice != '' AND pspice != 'N/A'
    THEN jsonb_build_array(pspice)
    ELSE '[]'::jsonb
  END;

UPDATE components SET pad_file_new =
  CASE WHEN pad_file IS NOT NULL AND pad_file != '' AND pad_file != 'N/A'
    THEN jsonb_build_array(pad_file)
    ELSE '[]'::jsonb
  END;

-- Step 3: Drop old VARCHAR columns
ALTER TABLE components DROP COLUMN IF EXISTS pcb_footprint;
ALTER TABLE components DROP COLUMN IF EXISTS schematic;
ALTER TABLE components DROP COLUMN IF EXISTS step_model;
ALTER TABLE components DROP COLUMN IF EXISTS pspice;
ALTER TABLE components DROP COLUMN IF EXISTS pad_file;

-- Step 4: Rename new columns to original names
ALTER TABLE components RENAME COLUMN pcb_footprint_new TO pcb_footprint;
ALTER TABLE components RENAME COLUMN schematic_new TO schematic;
ALTER TABLE components RENAME COLUMN step_model_new TO step_model;
ALTER TABLE components RENAME COLUMN pspice_new TO pspice;
ALTER TABLE components RENAME COLUMN pad_file_new TO pad_file;

-- Step 5: Add GIN indexes for JSONB containment queries
CREATE INDEX IF NOT EXISTS idx_components_pcb_footprint ON components USING GIN (pcb_footprint);
CREATE INDEX IF NOT EXISTS idx_components_schematic ON components USING GIN (schematic);
CREATE INDEX IF NOT EXISTS idx_components_step_model ON components USING GIN (step_model);
CREATE INDEX IF NOT EXISTS idx_components_pspice ON components USING GIN (pspice);
CREATE INDEX IF NOT EXISTS idx_components_pad_file ON components USING GIN (pad_file);

-- Step 6: Update schema version
INSERT INTO schema_version (version, description) VALUES
  ('1.7.0', 'JSONB CAD columns, flat file storage, synced with app version')
ON CONFLICT (version) DO NOTHING;
