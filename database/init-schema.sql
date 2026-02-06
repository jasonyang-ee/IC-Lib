-- ============================================================================
-- AllegroSQL Database Schema - Simplified Single-Table Architecture
-- ============================================================================
-- This schema uses a single components table instead of category-specific
-- tables for simpler maintenance and better flexibility
-- PostgreSQL 18+ with native uuidv7() support
-- ============================================================================

-- ============================================================================
-- PART 1: REFERENCE TABLES
-- ============================================================================

-- Table: component_categories
-- Stores categories with part number configuration
-- Now uses UUID primary key
CREATE TABLE IF NOT EXISTS component_categories (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    prefix VARCHAR(20) NOT NULL,
    leading_zeros INTEGER DEFAULT 5,
    display_order INTEGER DEFAULT 0
);

-- Insert default categories
INSERT INTO component_categories (name, description, prefix, leading_zeros, display_order) VALUES
    ('Capacitors', 'Capacitors and capacitor arrays', 'CAP', 5, 1),
    ('Resistors', 'Resistors and resistor arrays', 'RES', 5, 2),
    ('Inductors', 'Inductors and coils', 'IND', 5, 3),
    ('Diodes', 'Diodes, LEDs, and rectifiers', 'DIODE', 5, 4),
    ('Transistors', 'BJTs, MOSFETs, and other transistors', 'FET', 5, 5),
    ('ICs', 'Integrated circuits', 'IC', 5, 6),
    ('Connectors', 'Connectors and headers', 'CONN', 5, 7),
    ('Switches', 'Switches and buttons', 'SW', 5, 8),
    ('Oscillators', 'Crystals, oscillators, and resonators', 'XTAL', 5, 9),
    ('MCU', 'Microcontroller', 'IC', 5, 10),
    ('Mechanical', 'Mechanical Parts', 'MECH', 5, 11),
    ('Misc', 'Miscellaneous Parts', 'MISC', 5, 12),
    ('Relays', 'Relays', 'RELAY', 5, 13),
    ('Transformers', 'Transformers', 'TRNS', 5, 14)
ON CONFLICT (name) DO NOTHING;

-- Table: manufacturers
-- Stores manufacturer information
CREATE TABLE IF NOT EXISTS manufacturers (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name VARCHAR(100) UNIQUE NOT NULL,
    website VARCHAR(500)
);

-- Table: distributors
-- Stores distributor information (Digikey, Mouser, etc.)
CREATE TABLE IF NOT EXISTS distributors (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name VARCHAR(100) UNIQUE NOT NULL,
    api_endpoint VARCHAR(500)
);

-- Insert default distributors
INSERT INTO distributors (name, api_endpoint) VALUES
    ('Digikey', 'https://api.digikey.com/v1'),
    ('Mouser', 'https://api.mouser.com/api/v1'),
    ('Newark', 'https://api.newark.com/v1'),
    ('Arrow', 'https://api.arrow.com/v1')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PART 2: MASTER COMPONENTS TABLE
-- ============================================================================

-- Table: components (Single unified component table)
-- Removed: status, notes, created_at (uuidv7 contains timestamp)
-- Added: sub_category4
CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    category_id UUID REFERENCES component_categories(id) ON DELETE SET NULL,
    part_number VARCHAR(100) UNIQUE NOT NULL,
    manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
    manufacturer_pn VARCHAR(200),
    description TEXT,
    value VARCHAR(100),
    
    -- Physical characteristics
    pcb_footprint VARCHAR(200),
    package_size VARCHAR(100),
    
    -- Sub-categorization (expanded to 4 levels)
    sub_category1 VARCHAR(100),
    sub_category2 VARCHAR(100),
    sub_category3 VARCHAR(100),
    sub_category4 VARCHAR(100),
    
    -- CAD files
    schematic VARCHAR(255),
    step_model VARCHAR(255),
    pspice VARCHAR(255),
    pad_file VARCHAR(255),
    
    -- Documentation
    datasheet_url VARCHAR(500),
    
    -- Approval Status (merged single status)
    approval_status VARCHAR(50) DEFAULT 'new',
    approval_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approval_date TIMESTAMP,
    
    -- Only updated_at is needed (created_at extracted from uuidv7)
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT check_approval_status CHECK (approval_status IN ('new', 'approved', 'archived', 'pending review', 'experimental'))
);

-- ============================================================================
-- PART 3: SUPPORTING TABLES
-- ============================================================================

-- Table: category_specifications
-- Master list of specification names/fields per category
-- This defines what specifications are available for each category
-- Managed in the Settings page
CREATE TABLE IF NOT EXISTS category_specifications (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    category_id UUID REFERENCES component_categories(id) ON DELETE CASCADE,
    spec_name VARCHAR(100) NOT NULL,
    unit VARCHAR(50),
    mapping_spec_names JSONB DEFAULT '[]'::jsonb,
    display_order INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, spec_name)
);

-- Table: component_specification_values
-- Stores the actual specification values for each component
-- Links to category_specifications for the spec definition
-- Each component stores its own values, but all use the same spec names from their category
CREATE TABLE IF NOT EXISTS component_specification_values (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    category_spec_id UUID REFERENCES category_specifications(id) ON DELETE CASCADE,
    spec_value VARCHAR(500),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(component_id, category_spec_id)
);

-- Table: components_alternative
-- Stores alternative manufacturer variants for the same component
-- Each alternative has its own manufacturer and part number
-- Distributor info links to these alternatives instead of the parent component
-- Note: The primary variant is the one stored in components table itself
CREATE TABLE IF NOT EXISTS components_alternative (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
    manufacturer_pn VARCHAR(200) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(component_id, manufacturer_id, manufacturer_pn)
);

-- Table: inventory_alternative
-- Stores inventory tracking for alternative parts
-- Each alternative part can have its own location and quantity
CREATE TABLE IF NOT EXISTS inventory_alternative (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    alternative_id UUID REFERENCES components_alternative(id) ON DELETE CASCADE,
    location VARCHAR(200),
    quantity INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(alternative_id)
);

-- Table: distributor_info
-- Stores pricing and availability from different distributors
-- Now links to components_alternative instead of components directly
CREATE TABLE IF NOT EXISTS distributor_info (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    alternative_id UUID REFERENCES components_alternative(id) ON DELETE CASCADE,
    distributor_id UUID REFERENCES distributors(id) ON DELETE CASCADE,
    sku VARCHAR(100),
    url VARCHAR(500),
    currency VARCHAR(10) DEFAULT 'USD',
    in_stock BOOLEAN DEFAULT false,
    stock_quantity INTEGER,
    minimum_order_quantity INTEGER DEFAULT 1,
    packaging VARCHAR(100),
    price_breaks JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_component_or_alternative CHECK (
        (component_id IS NOT NULL AND alternative_id IS NULL) OR
        (component_id IS NULL AND alternative_id IS NOT NULL)
    ),
    CONSTRAINT distributor_info_component_distributor_unique UNIQUE(component_id, distributor_id),
    CONSTRAINT distributor_info_alternative_distributor_unique UNIQUE(alternative_id, distributor_id)
);

-- Table: inventory
-- Tracks physical component inventory
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    location VARCHAR(200),
    quantity INTEGER DEFAULT 0,
    minimum_quantity INTEGER DEFAULT 0,
    last_counted TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(component_id)
);

-- Table: footprint_sources
-- Tracks footprint files and their sources
CREATE TABLE IF NOT EXISTS footprint_sources (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    source VARCHAR(100),
    footprint_path VARCHAR(500),
    symbol_path VARCHAR(500),
    model_3d_path VARCHAR(500),
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PART 4: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Components table indexes
CREATE INDEX IF NOT EXISTS idx_components_id ON components(id);
CREATE INDEX IF NOT EXISTS idx_components_category ON components(category_id);
CREATE INDEX IF NOT EXISTS idx_components_manufacturer ON components(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_components_part_number ON components(part_number);
CREATE INDEX IF NOT EXISTS idx_components_approval_status ON components(approval_status);

-- Category specifications indexes
CREATE INDEX IF NOT EXISTS idx_category_specs_category ON category_specifications(category_id);

-- Component specification values indexes
CREATE INDEX IF NOT EXISTS idx_comp_spec_values_component ON component_specification_values(component_id);
CREATE INDEX IF NOT EXISTS idx_comp_spec_values_category_spec ON component_specification_values(category_spec_id);

-- Distributor info indexes
CREATE INDEX IF NOT EXISTS idx_distributor_info_component ON distributor_info(component_id);
CREATE INDEX IF NOT EXISTS idx_distributor_info_alternative ON distributor_info(alternative_id);
CREATE INDEX IF NOT EXISTS idx_distributor_info_distributor ON distributor_info(distributor_id);

-- Components alternative indexes
CREATE INDEX IF NOT EXISTS idx_components_alternative_component_id ON components_alternative(component_id);
CREATE INDEX IF NOT EXISTS idx_components_alternative_manufacturer ON components_alternative(manufacturer_id);

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_component ON inventory(component_id);

-- Footprint sources indexes
CREATE INDEX IF NOT EXISTS idx_footprint_sources_component ON footprint_sources(component_id);

-- ============================================================================
-- PART 5: TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp on components
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_components_updated_at
    BEFORE UPDATE ON components
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_category_specs_updated_at
    BEFORE UPDATE ON category_specifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_components_alternative_updated_at
    BEFORE UPDATE ON components_alternative
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_component_spec_values_updated_at
    BEFORE UPDATE ON component_specification_values
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 6: VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: components_full
-- Components with joined category, manufacturer, and distributor info
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
-- Convenient view to see component specifications with their names and units
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

-- ============================================================================
-- PART 7: HELPER FUNCTION FOR PART_TYPE
-- ============================================================================

-- Function to generate part_type string from category and subcategories
-- Now includes sub_category4
CREATE OR REPLACE FUNCTION get_part_type(
    p_category_id UUID,
    p_sub_category1 VARCHAR,
    p_sub_category2 VARCHAR,
    p_sub_category3 VARCHAR,
    p_sub_category4 VARCHAR DEFAULT NULL
) RETURNS VARCHAR AS $$
DECLARE
    v_category_name VARCHAR;
    v_part_type VARCHAR;
BEGIN
    -- Get category name
    SELECT name INTO v_category_name
    FROM component_categories
    WHERE id = p_category_id;
    
    -- Build part_type string, skipping NULL or empty subcategories
    IF v_category_name IS NOT NULL THEN
        v_part_type := v_category_name;
        
        IF p_sub_category1 IS NOT NULL AND TRIM(p_sub_category1) <> '' THEN
            v_part_type := v_part_type || '/' || p_sub_category1;
            
            IF p_sub_category2 IS NOT NULL AND TRIM(p_sub_category2) <> '' THEN
                v_part_type := v_part_type || '/' || p_sub_category2;
                
                IF p_sub_category3 IS NOT NULL AND TRIM(p_sub_category3) <> '' THEN
                    v_part_type := v_part_type || '/' || p_sub_category3;
                    
                    IF p_sub_category4 IS NOT NULL AND TRIM(p_sub_category4) <> '' THEN
                        v_part_type := v_part_type || '/' || p_sub_category4;
                    END IF;
                END IF;
            END IF;
        END IF;
        
        RETURN v_part_type;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a view that includes the computed part_type
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

-- Create a view that includes the alternative parts with manufacturer name
CREATE OR REPLACE VIEW alternative_parts AS
SELECT 
    ca.*,
    m.name AS manufacturer_name
FROM components_alternative ca
LEFT JOIN manufacturers m ON ca.manufacturer_id = m.id;

-- ============================================================================
-- Schema version tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
    version VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT INTO schema_version (version, description) VALUES
    ('3.0.0', 'UUID v7 migration, removed status/notes, added sub_category4')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- Sample Category Specifications (Master Spec Definitions)
-- ============================================================================

-- Get category IDs for spec insertion
DO $$
DECLARE
    cap_id UUID;
    res_id UUID;
    ind_id UUID;
    dio_id UUID;
    tra_id UUID;
    ic_id UUID;
    mcu_id UUID;
BEGIN
    SELECT id INTO cap_id FROM component_categories WHERE name = 'Capacitors';
    SELECT id INTO res_id FROM component_categories WHERE name = 'Resistors';
    SELECT id INTO ind_id FROM component_categories WHERE name = 'Inductors';
    SELECT id INTO dio_id FROM component_categories WHERE name = 'Diodes';
    SELECT id INTO tra_id FROM component_categories WHERE name = 'Transistors';
    SELECT id INTO ic_id FROM component_categories WHERE name = 'ICs';
    SELECT id INTO mcu_id FROM component_categories WHERE name = 'MCU';

    -- Capacitors specifications
    INSERT INTO category_specifications (category_id, spec_name, unit, mapping_spec_names, display_order, is_required) VALUES
        (cap_id, 'Capacitance', 'F', '["Capacitance"]'::jsonb, 1, false),
        (cap_id, 'Voltage Rating', 'V', '["Voltage - Rated"]'::jsonb, 2, false),
        (cap_id, 'Tolerance', '%', '["Tolerance"]'::jsonb, 3, false),
        (cap_id, 'Temperature Coefficient', '', '["Temperature Coefficient"]'::jsonb, 4, false),
        (cap_id, 'ESR', 'Ohms', '["ESR"]'::jsonb, 5, false),
        (cap_id, 'Operating Temperature', '', '["Operating Temperature"]'::jsonb, 6, false)
    ON CONFLICT (category_id, spec_name) DO NOTHING;

    -- Resistors specifications
    INSERT INTO category_specifications (category_id, spec_name, unit, mapping_spec_names, display_order, is_required) VALUES
        (res_id, 'Resistance', 'Ohms', '["Resistance"]'::jsonb, 1, false),
        (res_id, 'Power', 'W', '["Power (Watts)"]'::jsonb, 2, false),
        (res_id, 'Tolerance', '%', '["Tolerance"]'::jsonb, 3, false),
        (res_id, 'Temperature Coefficient', 'ppm/°C', '["Temperature Coefficient"]'::jsonb, 4, false),
        (res_id, 'Operating Temperature', '', '["Operating Temperature"]'::jsonb, 5, false)
    ON CONFLICT (category_id, spec_name) DO NOTHING;

    -- Inductors specifications
    INSERT INTO category_specifications (category_id, spec_name, unit, mapping_spec_names, display_order, is_required) VALUES
        (ind_id, 'Inductance', 'H', '["Inductance"]'::jsonb, 1, false),
        (ind_id, 'Current Rating', 'A', '["Current Rating (Amps)"]'::jsonb, 2, false),
        (ind_id, 'Tolerance', '%', '["Tolerance"]'::jsonb, 3, false),
        (ind_id, 'DC Resistance', 'Ω', '["DC Resistance (DCR)"]'::jsonb, 4, false),
        (ind_id, 'Saturation Current', 'A', '["Current - Saturation (Isat)"]'::jsonb, 5, false),
        (ind_id, 'Self-Resonant Frequency', 'Hz', '["Frequency - Self Resonant"]'::jsonb, 6, false),
        (ind_id, 'Operating Temperature', '', '["Operating Temperature"]'::jsonb, 7, false)
    ON CONFLICT (category_id, spec_name) DO NOTHING;

    -- Diodes specifications
    INSERT INTO category_specifications (category_id, spec_name, unit, mapping_spec_names, display_order, is_required) VALUES
        (dio_id, 'Forward Voltage', '', '["Voltage - Forward (Vf) (Max) @ If"]'::jsonb, 1, false),
        (dio_id, 'Reverse Voltage', 'V', '["Voltage - DC Reverse (Vr) (Max)"]'::jsonb, 2, false),
        (dio_id, 'Current Rectified', 'A', '["Current - Average Rectified (Io)"]'::jsonb, 3, true),
        (dio_id, 'Reverse Leakage Current', '', '["Current - Reverse Leakage @ Vr"]'::jsonb, 4, false),
        (dio_id, 'Technology', '', '["Technology"]'::jsonb, 5, false)
    ON CONFLICT (category_id, spec_name) DO NOTHING;

    -- Transistors specifications
    INSERT INTO category_specifications (category_id, spec_name, unit, mapping_spec_names, display_order, is_required) VALUES
        (tra_id, 'Transistor Type', '', '["Configuration"]'::jsonb, 1, false),
        (tra_id, 'Vdss', 'V', '["Drain to Source Voltage (Vdss)"]'::jsonb, 2, false),
        (tra_id, 'Id', 'A', '["Current - Continuous Drain (Id) @ 25°C"]'::jsonb, 3, false),
        (tra_id, 'Rds On', '', '["Rds On (Max) @ Id, Vgs"]'::jsonb, 4, false),
        (tra_id, 'Vgs(th)', '', '["Vgs(th) (Max) @ Id"]'::jsonb, 5, false),
        (tra_id, 'Gate Charge (Qg)', '', '["Gate Charge (Qg) (Max) @ Vgs"]'::jsonb, 6, false),
        (tra_id, 'Input Capacitance (Ciss)', '', '["Input Capacitance (Ciss) (Max) @ Vds"]'::jsonb, 7, false),
        (tra_id, 'Power', 'W', '["Power - Max"]'::jsonb, 8, false),
        (tra_id, 'Operating Temperature', '', '["Operating Temperature"]'::jsonb, 9, false)
    ON CONFLICT (category_id, spec_name) DO NOTHING;

    -- ICs specifications
    INSERT INTO category_specifications (category_id, spec_name, unit, mapping_spec_names, display_order, is_required) VALUES
        (ic_id, 'Supply Voltage', 'V', '["Supply Voltage"]'::jsonb, 1, false),
        (ic_id, 'Number of Channels', '', '["Number of Channels"]'::jsonb, 2, false),
        (ic_id, 'Operating Current', 'A', '["Operating Current"]'::jsonb, 3, false),
        (ic_id, 'Operating Temperature', '', '["Operating Temperature"]'::jsonb, 4, false)
    ON CONFLICT (category_id, spec_name) DO NOTHING;

    -- MCU specifications
    INSERT INTO category_specifications (category_id, spec_name, unit, mapping_spec_names, display_order, is_required) VALUES
        (mcu_id, 'Supply Voltage', 'V', '["Supply Voltage"]'::jsonb, 1, false),
        (mcu_id, 'Clock Speed', 'Hz', '["Clock Speed"]'::jsonb, 2, false),
        (mcu_id, 'Flash Memory', 'KB', '["Flash Memory"]'::jsonb, 3, false),
        (mcu_id, 'RAM', 'KB', '["RAM"]'::jsonb, 4, false),
        (mcu_id, 'Operating Temperature', '', '["Operating Temperature"]'::jsonb, 5, false)
    ON CONFLICT (category_id, spec_name) DO NOTHING;
END $$;

-- ============================================================================
-- PART 8: ACTIVITY LOG (Audit Trail)
-- ============================================================================

-- Table: activity_log
-- Stores component activity history for dashboard
-- Simplified: removed description and category_name, added flexible details JSONB
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    component_id UUID REFERENCES components(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    part_number VARCHAR(100) NOT NULL,
    activity_type VARCHAR(50) NOT NULL, -- 'added', 'updated', 'deleted', 'inventory_updated', 'inventory_consumed', 'location_updated', 'user_login', 'user_logout', etc.
    details JSONB NOT NULL DEFAULT '{}'::jsonb -- Flexible JSON for all change details
);

-- Index for faster queries (using uuidv7 for ordering by time)
CREATE INDEX IF NOT EXISTS idx_activity_log_id ON activity_log(id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_component ON activity_log(component_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_part_number ON activity_log(part_number);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);

-- ============================================================================
-- PART 9: PROJECTS
-- ============================================================================

-- Table: projects
-- Stores project information
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'archived'
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: project_components
-- Links components to projects with quantity used
CREATE TABLE IF NOT EXISTS project_components (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    alternative_id UUID REFERENCES components_alternative(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Ensure only one of component_id or alternative_id is set
    CHECK (
        (component_id IS NOT NULL AND alternative_id IS NULL) OR
        (component_id IS NULL AND alternative_id IS NOT NULL)
    )
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_project_components_project ON project_components(project_id);
CREATE INDEX IF NOT EXISTS idx_project_components_component ON project_components(component_id);
CREATE INDEX IF NOT EXISTS idx_project_components_alternative ON project_components(alternative_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_project_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project_timestamp ON projects;
CREATE TRIGGER trigger_update_project_timestamp
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_project_timestamp();

DROP TRIGGER IF EXISTS trigger_update_project_component_timestamp ON project_components;
CREATE TRIGGER trigger_update_project_component_timestamp
    BEFORE UPDATE ON project_components
    FOR EACH ROW
    EXECUTE FUNCTION update_project_timestamp();

-- ============================================================================
-- PART 10: TRIGGERS FOR AUTO-SYNC
-- ============================================================================

-- Function: Auto-create inventory entry when component is added
CREATE OR REPLACE FUNCTION create_inventory_entry()
RETURNS TRIGGER AS $$
BEGIN
    -- Automatically create an inventory entry with 0 quantity
    INSERT INTO inventory (component_id, quantity, minimum_quantity, location)
    VALUES (NEW.id, 0, 0, NULL)
    ON CONFLICT (component_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Create inventory entry on component insert
DROP TRIGGER IF EXISTS trigger_create_inventory ON components;
CREATE TRIGGER trigger_create_inventory
    AFTER INSERT ON components
    FOR EACH ROW
    EXECUTE FUNCTION create_inventory_entry();

-- ============================================================================
-- PART 11: BACKFILL INVENTORY FOR EXISTING COMPONENTS
-- ============================================================================

-- Create inventory entries for any existing components that don't have one
INSERT INTO inventory (component_id, quantity, minimum_quantity, location)
SELECT 
    c.id,
    0,
    0,
    NULL
FROM components c
WHERE NOT EXISTS (
    SELECT 1 FROM inventory i WHERE i.component_id = c.id
)
ON CONFLICT (component_id) DO NOTHING;

-- ============================================================================
-- PART 12: ENGINEER CHANGE ORDER (ECO) TABLES
-- ============================================================================

-- Table: eco_approval_stages
-- Defines the approval pipeline (configurable stages in order)
CREATE TABLE IF NOT EXISTS eco_approval_stages (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    stage_name VARCHAR(100) NOT NULL,
    stage_order INTEGER NOT NULL,
    required_approvals INTEGER NOT NULL DEFAULT 1,
    required_role VARCHAR(50) NOT NULL DEFAULT 'approver',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_stage_order UNIQUE(stage_order)
);

-- Insert default approval stage
INSERT INTO eco_approval_stages (stage_name, stage_order, required_approvals, required_role)
SELECT 'Review & Approval', 1, 1, 'approver'
WHERE NOT EXISTS (SELECT 1 FROM eco_approval_stages);

-- Table: eco_settings
-- Stores ECO numbering configuration (singleton)
CREATE TABLE IF NOT EXISTS eco_settings (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    prefix VARCHAR(20) NOT NULL DEFAULT 'ECO-',
    leading_zeros INTEGER NOT NULL DEFAULT 6,
    next_number INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Only one settings row should exist (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_eco_settings_singleton ON eco_settings((1));

-- Insert default ECO settings
INSERT INTO eco_settings (prefix, leading_zeros, next_number)
SELECT 'ECO-', 6, 1
WHERE NOT EXISTS (SELECT 1 FROM eco_settings);

-- Table: eco_orders
-- Stores ECO header information
CREATE TABLE IF NOT EXISTS eco_orders (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    eco_number VARCHAR(20) UNIQUE NOT NULL, -- Format: ECO-XXXXXX (6 digit sequential)
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    part_number VARCHAR(100) NOT NULL, -- Denormalized for quick access
    initiated_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_review', 'approved', 'rejected'
    current_stage_id UUID REFERENCES eco_approval_stages(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_eco_status CHECK (status IN ('pending', 'in_review', 'approved', 'rejected'))
);

-- Table: eco_stage_approvers
-- Assigns specific users to approval stages
-- Allows configurable N-of-M approvals (e.g., any 2 of users A,B,C,D)
CREATE TABLE IF NOT EXISTS eco_stage_approvers (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    stage_id UUID NOT NULL REFERENCES eco_approval_stages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(stage_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_eco_stage_approvers_stage ON eco_stage_approvers(stage_id);
CREATE INDEX IF NOT EXISTS idx_eco_stage_approvers_user ON eco_stage_approvers(user_id);

-- Table: eco_approvals
-- Tracks individual approval/rejection votes per ECO per stage
CREATE TABLE IF NOT EXISTS eco_approvals (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    eco_id UUID NOT NULL REFERENCES eco_orders(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES eco_approval_stages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    decision VARCHAR(20) NOT NULL,
    comments TEXT,
    CONSTRAINT check_approval_decision CHECK (decision IN ('approved', 'rejected')),
    CONSTRAINT unique_vote_per_stage UNIQUE(eco_id, stage_id, user_id)
);

-- Table: eco_changes
-- Stores the buffered component field changes
CREATE TABLE IF NOT EXISTS eco_changes (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    eco_id UUID NOT NULL REFERENCES eco_orders(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL, -- e.g., 'description', 'value', 'pcb_footprint', etc.
    old_value TEXT,
    new_value TEXT
);

-- Table: eco_distributors
-- Stores buffered distributor information changes
CREATE TABLE IF NOT EXISTS eco_distributors (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    eco_id UUID NOT NULL REFERENCES eco_orders(id) ON DELETE CASCADE,
    alternative_id UUID REFERENCES components_alternative(id) ON DELETE CASCADE, -- NULL for primary component
    distributor_id UUID REFERENCES distributors(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL, -- 'add', 'update', 'delete'
    sku VARCHAR(100),
    url VARCHAR(500),
    currency VARCHAR(10) DEFAULT 'USD',
    in_stock BOOLEAN DEFAULT false,
    stock_quantity INTEGER,
    minimum_order_quantity INTEGER DEFAULT 1,
    packaging VARCHAR(100),
    price_breaks JSONB,
    CONSTRAINT check_eco_dist_action CHECK (action IN ('add', 'update', 'delete'))
);

-- Table: eco_alternative_parts
-- Stores buffered alternative parts changes
CREATE TABLE IF NOT EXISTS eco_alternative_parts (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    eco_id UUID NOT NULL REFERENCES eco_orders(id) ON DELETE CASCADE,
    alternative_id UUID REFERENCES components_alternative(id) ON DELETE CASCADE, -- NULL for new alternatives
    action VARCHAR(20) NOT NULL, -- 'add', 'update', 'delete'
    manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
    manufacturer_pn VARCHAR(200),
    CONSTRAINT check_eco_alt_action CHECK (action IN ('add', 'update', 'delete'))
);

-- Table: eco_specifications
-- Stores buffered specification changes
CREATE TABLE IF NOT EXISTS eco_specifications (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    eco_id UUID NOT NULL REFERENCES eco_orders(id) ON DELETE CASCADE,
    category_spec_id UUID REFERENCES category_specifications(id) ON DELETE CASCADE,
    old_value VARCHAR(500),
    new_value VARCHAR(500)
);

-- Indexes for ECO tables
CREATE INDEX IF NOT EXISTS idx_eco_orders_component ON eco_orders(component_id);
CREATE INDEX IF NOT EXISTS idx_eco_orders_status ON eco_orders(status);
CREATE INDEX IF NOT EXISTS idx_eco_orders_eco_number ON eco_orders(eco_number);
CREATE INDEX IF NOT EXISTS idx_eco_orders_id ON eco_orders(id DESC);
CREATE INDEX IF NOT EXISTS idx_eco_changes_eco ON eco_changes(eco_id);
CREATE INDEX IF NOT EXISTS idx_eco_distributors_eco ON eco_distributors(eco_id);
CREATE INDEX IF NOT EXISTS idx_eco_alternative_parts_eco ON eco_alternative_parts(eco_id);
CREATE INDEX IF NOT EXISTS idx_eco_specifications_eco ON eco_specifications(eco_id);
CREATE INDEX IF NOT EXISTS idx_eco_approvals_eco ON eco_approvals(eco_id);
CREATE INDEX IF NOT EXISTS idx_eco_approvals_stage ON eco_approvals(stage_id);

-- Trigger to update eco_orders updated_at timestamp
CREATE OR REPLACE TRIGGER update_eco_orders_updated_at
    BEFORE UPDATE ON eco_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update eco_approval_stages updated_at timestamp
CREATE OR REPLACE TRIGGER update_eco_approval_stages_updated_at
    BEFORE UPDATE ON eco_approval_stages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update eco_settings updated_at timestamp
CREATE OR REPLACE TRIGGER update_eco_settings_updated_at
    BEFORE UPDATE ON eco_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to generate next ECO number
CREATE OR REPLACE FUNCTION generate_eco_number()
RETURNS VARCHAR AS $$
DECLARE
    next_number INTEGER;
    eco_num VARCHAR(20);
BEGIN
    -- Get the highest ECO number and increment
    SELECT COALESCE(MAX(CAST(SUBSTRING(eco_number FROM 5) AS INTEGER)), 0) + 1
    INTO next_number
    FROM eco_orders;
    
    -- Format as ECO-XXXXXX (6 digits with leading zeros)
    eco_num := 'ECO-' || LPAD(next_number::TEXT, 6, '0');
    
    RETURN eco_num;
END;
$$ LANGUAGE plpgsql;

-- View: eco_orders_full
-- ECO orders with user and stage information
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

-- ============================================================================
-- PART 13: HELPER FUNCTION TO EXTRACT TIMESTAMP FROM UUIDV7
-- ============================================================================

-- Function to extract timestamp from uuidv7
-- This allows querying by creation time without storing created_at
CREATE OR REPLACE FUNCTION extract_timestamp_from_uuidv7(uuid_val UUID)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    hex_str TEXT;
    unix_ms BIGINT;
BEGIN
    -- Convert UUID to hex string and extract first 12 characters (48 bits for timestamp)
    hex_str := REPLACE(uuid_val::TEXT, '-', '');
    unix_ms := ('x' || SUBSTRING(hex_str FROM 1 FOR 12))::bit(48)::bigint;
    
    -- Convert milliseconds to timestamp
    RETURN to_timestamp(unix_ms / 1000.0) AT TIME ZONE 'UTC';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Alias function for easier use
CREATE OR REPLACE FUNCTION created_at(uuid_val UUID)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN extract_timestamp_from_uuidv7(uuid_val);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- PART 14: SMTP & EMAIL NOTIFICATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS smtp_settings (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 587,
    secure BOOLEAN DEFAULT false,
    no_auth BOOLEAN DEFAULT false,
    auth_user VARCHAR(255),
    auth_password_encrypted TEXT,
    from_address VARCHAR(255) NOT NULL,
    from_name VARCHAR(100) DEFAULT 'IC Library System',
    enabled BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- Only one SMTP configuration should exist at a time (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_smtp_settings_singleton ON smtp_settings((1));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE TRIGGER update_smtp_settings_updated_at
    BEFORE UPDATE ON smtp_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS email_notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notify_eco_created BOOLEAN DEFAULT true,
    notify_eco_approved BOOLEAN DEFAULT true,
    notify_eco_rejected BOOLEAN DEFAULT true,
    notify_eco_pending_approval BOOLEAN DEFAULT true,
    notify_eco_stage_advanced BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE OR REPLACE TRIGGER update_email_prefs_updated_at
    BEFORE UPDATE ON email_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS email_log (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    template_name VARCHAR(100),
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    eco_id UUID REFERENCES eco_orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_email_log_id ON email_log(id DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_eco ON email_log(eco_id);

