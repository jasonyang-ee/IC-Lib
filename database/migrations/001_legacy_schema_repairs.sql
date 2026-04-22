-- Legacy schema repairs for databases created before the current base schema.
-- Keep this migration idempotent so it is safe on both upgraded and fresh installs.

-- Add file_storage_path to users table (for per-user library path)
ALTER TABLE users ADD COLUMN IF NOT EXISTS file_storage_path VARCHAR(1000);

-- Add missing-file marker to cad_files for existing databases
ALTER TABLE cad_files ADD COLUMN IF NOT EXISTS missing BOOLEAN DEFAULT FALSE;

-- Add notes column to project_components for existing databases
ALTER TABLE project_components ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create admin_settings table for existing databases
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    global_prefix_enabled BOOLEAN NOT NULL DEFAULT false,
    global_prefix VARCHAR(20) NOT NULL DEFAULT '',
    global_leading_zeros INTEGER NOT NULL DEFAULT 5,
    eco_logo_filename VARCHAR(200) DEFAULT '',
    eco_pdf_header_text VARCHAR(200) DEFAULT 'Engineer Change Order',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_settings_singleton ON admin_settings((1));

-- Create eco_cad_files table for existing databases
CREATE TABLE IF NOT EXISTS eco_cad_files (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    eco_id UUID NOT NULL REFERENCES eco_orders(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('link', 'unlink')),
    cad_file_id UUID REFERENCES cad_files(id) ON DELETE CASCADE,
    file_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(500)
);
CREATE INDEX IF NOT EXISTS idx_eco_cad_files_eco ON eco_cad_files(eco_id);
CREATE INDEX IF NOT EXISTS idx_eco_cad_files_cad_file ON eco_cad_files(cad_file_id);

-- Add distributors JSONB column to eco_alternative_parts for existing databases
ALTER TABLE eco_alternative_parts ADD COLUMN IF NOT EXISTS distributors JSONB DEFAULT '[]'::jsonb;

-- Add manufacturer_name text column - stored as string for staging (find-or-create on approval)
ALTER TABLE eco_alternative_parts ADD COLUMN IF NOT EXISTS manufacturer_name VARCHAR(200);

-- Add eco_logo_filename to admin_settings
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS eco_logo_filename VARCHAR(200) DEFAULT '';

-- Add eco_pdf_header_text to admin_settings
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS eco_pdf_header_text VARCHAR(200) DEFAULT 'Engineer Change Order';

-- Remove unique constraint on stage_order to allow parallel stages (same order = parallel)
ALTER TABLE eco_approval_stages DROP CONSTRAINT IF EXISTS unique_stage_order;

-- Add pipeline_types to eco_approval_stages (which pipeline tags a stage participates in)
ALTER TABLE eco_approval_stages ADD COLUMN IF NOT EXISTS pipeline_types TEXT[];
UPDATE eco_approval_stages
SET pipeline_types = (
    SELECT ARRAY(
        SELECT DISTINCT mapped_type
        FROM (
            SELECT unnest(
                CASE
                    WHEN eco_approval_stages.pipeline_types IS NULL OR array_length(eco_approval_stages.pipeline_types, 1) IS NULL THEN ARRAY['proto_status_change', 'prod_status_change', 'spec', 'filename', 'distributor']::text[]
                    WHEN array_length(eco_approval_stages.pipeline_types, 1) = 1 AND eco_approval_stages.pipeline_types[1] = 'general' THEN ARRAY['proto_status_change', 'prod_status_change', 'spec', 'filename', 'distributor']::text[]
                    ELSE eco_approval_stages.pipeline_types
                END
            ) AS original_type
        ) AS original_types
        CROSS JOIN LATERAL unnest(
            CASE
                WHEN original_type = 'status_change' THEN ARRAY['proto_status_change', 'prod_status_change']::text[]
                WHEN original_type = 'spec_cad' THEN ARRAY['spec', 'filename']::text[]
                WHEN original_type = 'general' THEN ARRAY['spec']::text[]
                ELSE ARRAY[original_type]::text[]
            END
        ) AS mapped(mapped_type)
    )
)
WHERE eco_approval_stages.pipeline_types IS NULL
     OR array_length(eco_approval_stages.pipeline_types, 1) IS NULL
     OR eco_approval_stages.pipeline_types && ARRAY['general', 'spec_cad', 'status_change']::text[];
UPDATE eco_approval_stages
SET pipeline_types = '{proto_status_change,prod_status_change,spec,filename,distributor}'::text[]
WHERE pipeline_types IS NULL OR array_length(pipeline_types, 1) IS NULL;
ALTER TABLE eco_approval_stages ALTER COLUMN pipeline_types SET DEFAULT '{proto_status_change,prod_status_change,spec,filename,distributor}';
ALTER TABLE eco_approval_stages ALTER COLUMN pipeline_types SET NOT NULL;

-- Migrate eco_orders from current_stage_id to current_stage_order
ALTER TABLE eco_orders ADD COLUMN IF NOT EXISTS current_stage_order INTEGER;
ALTER TABLE eco_orders ADD COLUMN IF NOT EXISTS pipeline_type VARCHAR(50) NOT NULL DEFAULT 'spec';
ALTER TABLE eco_orders ADD COLUMN IF NOT EXISTS pipeline_types TEXT[];
UPDATE eco_orders
SET pipeline_types = CASE
    WHEN pipeline_type = 'spec_cad' THEN ARRAY['spec', 'filename']::text[]
    WHEN pipeline_type = 'general' THEN ARRAY['spec']::text[]
    WHEN pipeline_type = 'status_change' THEN ARRAY['proto_status_change', 'prod_status_change']::text[]
    WHEN pipeline_type IN ('proto_status_change', 'prod_status_change', 'spec', 'filename', 'distributor') THEN ARRAY[pipeline_type]::text[]
    ELSE ARRAY['spec']::text[]
END
WHERE pipeline_types IS NULL OR array_length(pipeline_types, 1) IS NULL;
ALTER TABLE eco_orders ALTER COLUMN pipeline_types SET DEFAULT '{spec}';
UPDATE eco_orders SET pipeline_types = '{spec}'::text[] WHERE pipeline_types IS NULL OR array_length(pipeline_types, 1) IS NULL;
ALTER TABLE eco_orders ALTER COLUMN pipeline_types SET NOT NULL;

-- Backfill current_stage_order from current_stage_id for existing records
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'eco_orders' AND column_name = 'current_stage_id') THEN
    UPDATE eco_orders eo SET current_stage_order = (
      SELECT stage_order FROM eco_approval_stages WHERE id = eo.current_stage_id
    ) WHERE eo.current_stage_id IS NOT NULL AND eo.current_stage_order IS NULL;
    ALTER TABLE eco_orders DROP COLUMN IF EXISTS current_stage_id;
  END IF;
END $$;

-- Add reviewer role to users table
DO $$
BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('read-only', 'reviewer', 'read-write', 'approver', 'admin'));
END $$;

-- Rename approval statuses: approved->production, experimental->prototype, pending review->reviewing
DO $$
BEGIN
  ALTER TABLE components DROP CONSTRAINT IF EXISTS check_approval_status;
  UPDATE components SET approval_status = 'production' WHERE approval_status = 'approved';
  UPDATE components SET approval_status = 'prototype' WHERE approval_status = 'experimental';
  UPDATE components SET approval_status = 'reviewing' WHERE approval_status = 'pending review';
  ALTER TABLE components ADD CONSTRAINT check_approval_status CHECK (approval_status IN ('new', 'production', 'archived', 'reviewing', 'prototype'));
END $$;

-- Replace legacy ECO pipeline tags with lifecycle and content tags
DO $$
BEGIN
  ALTER TABLE eco_orders DROP CONSTRAINT IF EXISTS check_pipeline_type;
  UPDATE eco_orders SET pipeline_type = 'proto_status_change' WHERE pipeline_type = 'status_change';
  UPDATE eco_orders SET pipeline_type = 'spec' WHERE pipeline_type IN ('general', 'spec_cad');
  ALTER TABLE eco_orders ADD CONSTRAINT check_pipeline_type CHECK (pipeline_type IN ('proto_status_change', 'prod_status_change', 'spec', 'filename', 'distributor'));
END $$;

-- Add parent_eco_id for ECO retry/rejection chain tracking
ALTER TABLE eco_orders ADD COLUMN IF NOT EXISTS parent_eco_id UUID REFERENCES eco_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_eco_orders_parent ON eco_orders(parent_eco_id);

-- Remove UNIQUE constraint on eco_number (retries reuse the same ECO number)
ALTER TABLE eco_orders DROP CONSTRAINT IF EXISTS eco_orders_eco_number_key;
DROP INDEX IF EXISTS eco_orders_eco_number_key;