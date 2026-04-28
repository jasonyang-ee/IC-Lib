-- 1.9.9
-- Stage shared file-library renames behind a single ECO that tracks all affected parts.

CREATE TABLE IF NOT EXISTS eco_file_rename_files (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    eco_id UUID NOT NULL REFERENCES eco_orders(id) ON DELETE CASCADE,
    cad_file_id UUID REFERENCES cad_files(id) ON DELETE SET NULL,
    file_type VARCHAR(50) NOT NULL,
    old_file_name VARCHAR(500) NOT NULL,
    new_file_name VARCHAR(500) NOT NULL,
    UNIQUE (eco_id, cad_file_id, old_file_name, new_file_name)
);

CREATE INDEX IF NOT EXISTS idx_eco_file_rename_files_eco ON eco_file_rename_files(eco_id);
CREATE INDEX IF NOT EXISTS idx_eco_file_rename_files_cad_file ON eco_file_rename_files(cad_file_id);

CREATE TABLE IF NOT EXISTS eco_file_rename_components (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    eco_id UUID NOT NULL REFERENCES eco_orders(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    part_number VARCHAR(100) NOT NULL,
    original_approval_status VARCHAR(50) NOT NULL,
    CONSTRAINT check_eco_file_rename_original_status CHECK (original_approval_status IN ('new', 'reviewing', 'prototype', 'production', 'archived')),
    UNIQUE (eco_id, component_id)
);

CREATE INDEX IF NOT EXISTS idx_eco_file_rename_components_eco ON eco_file_rename_components(eco_id);
CREATE INDEX IF NOT EXISTS idx_eco_file_rename_components_component ON eco_file_rename_components(component_id);
