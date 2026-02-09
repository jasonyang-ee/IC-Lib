-- Migration: Convert CAD file columns from VARCHAR to JSONB arrays
-- Version: 1.7.0
-- Description: Supports multiple CAD files per type per component

-- Step 0: Check if migration is needed (skip if columns are already JSONB)
DO $$
BEGIN
  -- If pcb_footprint is already jsonb, skip the entire migration
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'components' AND column_name = 'pcb_footprint' AND data_type = 'jsonb'
  ) THEN
    RAISE NOTICE 'CAD columns are already JSONB - skipping migration';
    RETURN;
  END IF;

  -- Step 1: Drop dependent views that use SELECT c.* from components
  DROP VIEW IF EXISTS components_full CASCADE;
  DROP VIEW IF EXISTS active_parts CASCADE;
  DROP VIEW IF EXISTS eco_orders_full CASCADE;
  DROP VIEW IF EXISTS component_specifications_view CASCADE;

  -- Step 2: Drop GIN indexes if they exist (they may conflict)
  DROP INDEX IF EXISTS idx_components_pcb_footprint;
  DROP INDEX IF EXISTS idx_components_schematic;
  DROP INDEX IF EXISTS idx_components_step_model;
  DROP INDEX IF EXISTS idx_components_pspice;
  DROP INDEX IF EXISTS idx_components_pad_file;

  -- Step 3: Add temporary JSONB columns
  ALTER TABLE components ADD COLUMN IF NOT EXISTS pcb_footprint_new JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE components ADD COLUMN IF NOT EXISTS schematic_new JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE components ADD COLUMN IF NOT EXISTS step_model_new JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE components ADD COLUMN IF NOT EXISTS pspice_new JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE components ADD COLUMN IF NOT EXISTS pad_file_new JSONB DEFAULT '[]'::jsonb;

  -- Step 4: Migrate existing data (wrap non-null, non-empty values in JSON arrays)
  UPDATE components SET pcb_footprint_new =
    CASE WHEN pcb_footprint IS NOT NULL AND pcb_footprint::text != '' AND pcb_footprint::text != 'N/A'
      THEN jsonb_build_array(pcb_footprint::text)
      ELSE '[]'::jsonb
    END;

  UPDATE components SET schematic_new =
    CASE WHEN schematic IS NOT NULL AND schematic::text != '' AND schematic::text != 'N/A'
      THEN jsonb_build_array(schematic::text)
      ELSE '[]'::jsonb
    END;

  UPDATE components SET step_model_new =
    CASE WHEN step_model IS NOT NULL AND step_model::text != '' AND step_model::text != 'N/A'
      THEN jsonb_build_array(step_model::text)
      ELSE '[]'::jsonb
    END;

  UPDATE components SET pspice_new =
    CASE WHEN pspice IS NOT NULL AND pspice::text != '' AND pspice::text != 'N/A'
      THEN jsonb_build_array(pspice::text)
      ELSE '[]'::jsonb
    END;

  UPDATE components SET pad_file_new =
    CASE WHEN pad_file IS NOT NULL AND pad_file::text != '' AND pad_file::text != 'N/A'
      THEN jsonb_build_array(pad_file::text)
      ELSE '[]'::jsonb
    END;

  -- Step 5: Drop old VARCHAR columns
  ALTER TABLE components DROP COLUMN IF EXISTS pcb_footprint;
  ALTER TABLE components DROP COLUMN IF EXISTS schematic;
  ALTER TABLE components DROP COLUMN IF EXISTS step_model;
  ALTER TABLE components DROP COLUMN IF EXISTS pspice;
  ALTER TABLE components DROP COLUMN IF EXISTS pad_file;

  -- Step 6: Rename new columns to original names
  ALTER TABLE components RENAME COLUMN pcb_footprint_new TO pcb_footprint;
  ALTER TABLE components RENAME COLUMN schematic_new TO schematic;
  ALTER TABLE components RENAME COLUMN step_model_new TO step_model;
  ALTER TABLE components RENAME COLUMN pspice_new TO pspice;
  ALTER TABLE components RENAME COLUMN pad_file_new TO pad_file;

END $$;

-- Step 7: Add GIN indexes for JSONB containment queries
CREATE INDEX IF NOT EXISTS idx_components_pcb_footprint ON components USING GIN (pcb_footprint);
CREATE INDEX IF NOT EXISTS idx_components_schematic ON components USING GIN (schematic);
CREATE INDEX IF NOT EXISTS idx_components_step_model ON components USING GIN (step_model);
CREATE INDEX IF NOT EXISTS idx_components_pspice ON components USING GIN (pspice);
CREATE INDEX IF NOT EXISTS idx_components_pad_file ON components USING GIN (pad_file);

-- Step 8: Recreate dependent views

-- View: components_full
CREATE OR REPLACE VIEW components_full AS
SELECT
    c.*,
    cat.name as category_name,
    cat.prefix as category_prefix,
    m.name as manufacturer_name,
    m.website as manufacturer_website,
    COUNT(DISTINCT di.id) as distributor_count,
    COALESCE(inv.total_quantity, 0) as inventory_quantity
FROM components c
LEFT JOIN component_categories cat ON c.category_id = cat.id
LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
LEFT JOIN distributor_info di ON c.id = di.component_id
LEFT JOIN (
    SELECT component_id, SUM(quantity) as total_quantity
    FROM inventory
    GROUP BY component_id
) inv ON c.id = inv.component_id
GROUP BY c.id, cat.name, cat.prefix, m.name, m.website, inv.total_quantity;

-- View: component_specifications_view
CREATE OR REPLACE VIEW component_specifications_view AS
SELECT
    csv.id,
    csv.component_id,
    c.part_number,
    c.category_id,
    cat.name as category_name,
    cs.spec_name,
    cs.unit,
    csv.spec_value,
    cs.is_required,
    cs.display_order,
    csv.updated_at
FROM component_specification_values csv
JOIN category_specifications cs ON csv.category_spec_id = cs.id
JOIN components c ON csv.component_id = c.id
JOIN component_categories cat ON c.category_id = cat.id
ORDER BY csv.component_id, cs.display_order;

-- View: active_parts
CREATE OR REPLACE VIEW active_parts AS
SELECT
    c.*,
    get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3, c.sub_category4) as part_type,
    m.name AS manufacturer_name,
    cat.name AS category_name,
    u.username AS approval_user_name
FROM components c
LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
LEFT JOIN component_categories cat ON c.category_id = cat.id
LEFT JOIN users u ON c.approval_user_id = u.id
WHERE c.approval_status != 'archived' OR c.approval_status IS NULL;

-- View: eco_orders_full
CREATE OR REPLACE VIEW eco_orders_full AS
SELECT
    eo.*,
    u1.username as initiated_by_name,
    u2.username as approved_by_name,
    c.part_number as component_part_number,
    c.description as component_description,
    cc.name as category_name,
    m.name as manufacturer_name,
    eas.stage_name as current_stage_name,
    eas.stage_order as current_stage_order,
    eas.required_approvals as current_stage_required_approvals
FROM eco_orders eo
LEFT JOIN users u1 ON eo.initiated_by = u1.id
LEFT JOIN users u2 ON eo.approved_by = u2.id
LEFT JOIN components c ON eo.component_id = c.id
LEFT JOIN component_categories cc ON c.category_id = cc.id
LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
LEFT JOIN eco_approval_stages eas ON eo.current_stage_id = eas.id
ORDER BY eo.id DESC;

-- Step 9: Update schema version
INSERT INTO schema_version (version, description) VALUES
  ('1.7.0', 'JSONB CAD columns, flat file storage, synced with app version')
ON CONFLICT (version) DO NOTHING;
