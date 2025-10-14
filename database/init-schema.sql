-- ============================================================================
-- AllegroSQL Database Schema - Simplified Single-Table Architecture
-- ============================================================================
-- This schema uses a single components table instead of category-specific
-- tables for simpler maintenance and better flexibility
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PART 1: REFERENCE TABLES
-- ============================================================================

-- Table: component_categories
-- Stores categories with part number configuration
CREATE TABLE IF NOT EXISTS component_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    prefix VARCHAR(20) NOT NULL,
    leading_zeros INTEGER DEFAULT 5,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT INTO component_categories (id, name, description, prefix, leading_zeros) VALUES
    (1, 'Capacitors', 'Capacitors and capacitor arrays', 'CAP', 4),
    (2, 'Resistors', 'Resistors and resistor arrays', 'RES', 4),
    (3, 'Inductors', 'Inductors and coils', 'IND', 4),
    (4, 'Diodes', 'Diodes, LEDs, and rectifiers', 'DIODE', 4),
    (5, 'Transistors', 'BJTs, MOSFETs, and other transistors', 'FET', 4),
    (6, 'ICs', 'Integrated circuits', 'IC', 4),
    (7, 'Connectors', 'Connectors and headers', 'CONN', 4),
    (8, 'Switches', 'Switches and buttons', 'SW', 4),
    (10, 'Oscillators', 'Crystals, oscillators, and resonators', 'XTAL', 4),
    (11, 'MCU', 'Microcontroller', 'IC', 4)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence to continue from 12
SELECT setval('component_categories_id_seq', 12, true);

-- Table: manufacturers
-- Stores manufacturer information
CREATE TABLE IF NOT EXISTS manufacturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    website VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: distributors
-- Stores distributor information (Digikey, Mouser, etc.)
CREATE TABLE IF NOT EXISTS distributors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    api_endpoint VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id INTEGER REFERENCES component_categories(id) ON DELETE SET NULL,
    part_number VARCHAR(100) UNIQUE NOT NULL,
    manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
    manufacturer_pn VARCHAR(200),
    description TEXT,
    value VARCHAR(100),
    
    -- Physical characteristics
    pcb_footprint VARCHAR(200),
    package_size VARCHAR(100),
    
    -- Sub-categorization
    sub_category1 VARCHAR(100),
    sub_category2 VARCHAR(100),
    sub_category3 VARCHAR(100),
    
    -- CAD files
    schematic VARCHAR(255),
    step_model VARCHAR(255),
    pspice VARCHAR(255),
    
    -- Documentation
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Active',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    CONSTRAINT check_status CHECK (status IN ('Active', 'Obsolete', 'NRND', 'Development'))
);

-- ============================================================================
-- PART 3: SUPPORTING TABLES
-- ============================================================================

-- Table: category_specifications
-- Master list of specification names/fields per category
-- This defines what specifications are available for each category
-- Managed in the Settings page
CREATE TABLE IF NOT EXISTS category_specifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id INTEGER REFERENCES component_categories(id) ON DELETE CASCADE,
    spec_name VARCHAR(100) NOT NULL,
    unit VARCHAR(50),
    display_order INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, spec_name)
);

-- Table: component_specification_values
-- Stores the actual specification values for each component
-- Links to category_specifications for the spec definition
-- Each component stores its own values, but all use the same spec names from their category
CREATE TABLE IF NOT EXISTS component_specification_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    category_spec_id UUID REFERENCES category_specifications(id) ON DELETE CASCADE,
    spec_value VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(component_id, category_spec_id)
);

-- Table: components_alternative
-- Stores alternative manufacturer variants for the same component
-- Each alternative has its own manufacturer and part number
-- Distributor info links to these alternatives instead of the parent component
-- Note: The primary variant is the one stored in components table itself
CREATE TABLE IF NOT EXISTS components_alternative (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_number VARCHAR(100) REFERENCES components(part_number) ON DELETE CASCADE,
    manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
    manufacturer_pn VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(part_number, manufacturer_id, manufacturer_pn)
);

-- Table: inventory_alternative
-- Stores inventory tracking for alternative parts
-- Each alternative part can have its own location and quantity
CREATE TABLE IF NOT EXISTS inventory_alternative (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alternative_id UUID REFERENCES components_alternative(id) ON DELETE CASCADE,
    location VARCHAR(200),
    quantity INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(alternative_id)
);

-- Table: distributor_info
-- Stores pricing and availability from different distributors
-- Now links to components_alternative instead of components directly
CREATE TABLE IF NOT EXISTS distributor_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    alternative_id UUID REFERENCES components_alternative(id) ON DELETE CASCADE,
    distributor_id UUID REFERENCES distributors(id) ON DELETE CASCADE,
    sku VARCHAR(100),
    url VARCHAR(500),
    price DECIMAL(10, 2),
    currency VARCHAR(10) DEFAULT 'USD',
    in_stock BOOLEAN DEFAULT false,
    stock_quantity INTEGER,
    minimum_order_quantity INTEGER DEFAULT 1,
    packaging VARCHAR(100),
    price_breaks JSONB,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_component_or_alternative CHECK (
        (component_id IS NOT NULL AND alternative_id IS NULL) OR
        (component_id IS NULL AND alternative_id IS NOT NULL)
    ),
    UNIQUE(component_id, distributor_id, sku),
    UNIQUE(alternative_id, distributor_id, sku)
);

-- Table: inventory
-- Tracks physical component inventory
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    location VARCHAR(200),
    quantity INTEGER DEFAULT 0,
    minimum_quantity INTEGER DEFAULT 0,
    last_counted TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: footprint_sources
-- Tracks footprint files and their sources
CREATE TABLE IF NOT EXISTS footprint_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    source VARCHAR(100),
    footprint_path VARCHAR(500),
    symbol_path VARCHAR(500),
    model_3d_path VARCHAR(500),
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- ============================================================================
-- PART 4: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Components table indexes
CREATE INDEX IF NOT EXISTS idx_components_category ON components(category_id);
CREATE INDEX IF NOT EXISTS idx_components_manufacturer ON components(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_components_part_number ON components(part_number);
CREATE INDEX IF NOT EXISTS idx_components_status ON components(status);
-- Note: part_type index removed as column is no longer generated

-- Category specifications indexes
CREATE INDEX IF NOT EXISTS idx_category_specs_category ON category_specifications(category_id);
CREATE INDEX IF NOT EXISTS idx_category_specs_display_order ON category_specifications(display_order);

-- Component specification values indexes
CREATE INDEX IF NOT EXISTS idx_comp_spec_values_component ON component_specification_values(component_id);
CREATE INDEX IF NOT EXISTS idx_comp_spec_values_category_spec ON component_specification_values(category_spec_id);

-- Distributor info indexes
CREATE INDEX IF NOT EXISTS idx_distributor_info_component ON distributor_info(component_id);
CREATE INDEX IF NOT EXISTS idx_distributor_info_alternative ON distributor_info(alternative_id);
CREATE INDEX IF NOT EXISTS idx_distributor_info_distributor ON distributor_info(distributor_id);

-- Components alternative indexes
CREATE INDEX IF NOT EXISTS idx_components_alternative_part_number ON components_alternative(part_number);
CREATE INDEX IF NOT EXISTS idx_components_alternative_manufacturer ON components_alternative(manufacturer_id);

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_component ON inventory(component_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location);

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

CREATE TRIGGER update_components_updated_at
    BEFORE UPDATE ON components
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_category_specs_updated_at
    BEFORE UPDATE ON category_specifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_components_alternative_updated_at
    BEFORE UPDATE ON components_alternative
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_component_spec_values_updated_at
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
    csv.created_at,
    csv.updated_at
FROM component_specification_values csv
JOIN category_specifications cs ON csv.category_spec_id = cs.id
JOIN components c ON csv.component_id = c.id
JOIN component_categories cat ON c.category_id = cat.id
ORDER BY csv.component_id, cs.display_order;

-- ============================================================================
-- PART 6: HELPER FUNCTION FOR PART_TYPE
-- ============================================================================

-- Function to generate part_type string from category and subcategories
-- This replaces the generated column which cannot use subqueries
-- Automatically ignores empty subcategories (NULL or empty string)
CREATE OR REPLACE FUNCTION get_part_type(
    p_category_id INTEGER,
    p_sub_category1 VARCHAR,
    p_sub_category2 VARCHAR,
    p_sub_category3 VARCHAR
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
CREATE OR REPLACE VIEW components_with_part_type AS
SELECT 
    c.*,
    get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3) as part_type,
	m.name AS manufacturer_name
	LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
	cat.name AS category_name
	LEFT JOIN component_categories cat ON c.category_id = cat.id
FROM components c;

-- Create a view that includes the alternative parts with manufacturer name
CREATE OR REPLACE VIEW components_alternative_with_mfg_name AS
SELECT 
    ca.*,
	m.name AS manufacturer_name
	LEFT JOIN manufacturers m ON ca.manufacturer_id = m.id
FROM components_alternative ca;

-- ============================================================================
-- Schema version tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
    version VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT INTO schema_version (version, description) VALUES
    ('2.0.0', 'Simplified single-table architecture')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- Sample Category Specifications (Master Spec Definitions)
-- ============================================================================

-- Capacitors specifications
INSERT INTO category_specifications (category_id, spec_name, unit, display_order, is_required) VALUES
    (1, 'Capacitance', 'F', 1, true),
    (1, 'Voltage Rating', 'V', 2, true),
    (1, 'Tolerance', '%', 3, false),
    (1, 'Dielectric Type', '', 4, false),
    (1, 'Temperature Coefficient', 'ppm/°C', 5, false),
    (1, 'ESR', 'Ω', 6, false),
    (1, 'Operating Temperature', '°C', 7, false)
ON CONFLICT (category_id, spec_name) DO NOTHING;

-- Resistors specifications
INSERT INTO category_specifications (category_id, spec_name, unit, display_order, is_required) VALUES
    (2, 'Resistance', 'Ω', 1, true),
    (2, 'Power Rating', 'W', 2, true),
    (2, 'Tolerance', '%', 3, false),
    (2, 'Temperature Coefficient', 'ppm/°C', 4, false),
    (2, 'Operating Temperature', '°C', 5, false)
ON CONFLICT (category_id, spec_name) DO NOTHING;

-- Inductors specifications
INSERT INTO category_specifications (category_id, spec_name, unit, display_order, is_required) VALUES
    (3, 'Inductance', 'H', 1, true),
    (3, 'Current Rating', 'A', 2, true),
    (3, 'Tolerance', '%', 3, false),
    (3, 'DC Resistance', 'Ω', 4, false),
    (3, 'Saturation Current', 'A', 5, false),
    (3, 'Self-Resonant Frequency', 'Hz', 6, false)
ON CONFLICT (category_id, spec_name) DO NOTHING;

-- Diodes specifications
INSERT INTO category_specifications (category_id, spec_name, unit, display_order, is_required) VALUES
    (4, 'Forward Voltage', 'V', 1, false),
    (4, 'Current Rating', 'A', 2, true),
    (4, 'Reverse Voltage', 'V', 3, false),
    (4, 'Power Dissipation', 'W', 4, false)
ON CONFLICT (category_id, spec_name) DO NOTHING;

-- Transistors specifications
INSERT INTO category_specifications (category_id, spec_name, unit, display_order, is_required) VALUES
    (5, 'Transistor Type', '', 1, true),
    (5, 'VDS/VCE Max', 'V', 2, true),
    (5, 'ID/IC Max', 'A', 3, true),
    (5, 'Power Dissipation', 'W', 4, false),
    (5, 'Gate Threshold Voltage', 'V', 5, false),
    (5, 'RDS(on)', 'Ω', 6, false)
ON CONFLICT (category_id, spec_name) DO NOTHING;

-- ICs specifications
INSERT INTO category_specifications (category_id, spec_name, unit, display_order, is_required) VALUES
    (6, 'Supply Voltage', 'V', 1, true),
    (6, 'Operating Current', 'A', 2, false),
    (6, 'Operating Temperature', '°C', 3, false),
    (6, 'Number of Channels', '', 4, false)
ON CONFLICT (category_id, spec_name) DO NOTHING;

-- ============================================================================
-- PART 5: ACTIVITY LOG
-- ============================================================================

-- Table: activity_log
-- Stores component activity history for dashboard
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    component_id UUID REFERENCES components(id) ON DELETE SET NULL,
    part_number VARCHAR(100) NOT NULL,
    description TEXT,
    category_name VARCHAR(100),
    activity_type VARCHAR(50) NOT NULL, -- 'added', 'updated', 'deleted', 'inventory_updated', 'inventory_consumed', 'location_updated'
    change_details JSONB, -- Store old/new values for inventory operations
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(activity_type);

-- ============================================================================
-- PART 6: TRIGGERS FOR AUTO-SYNC
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

-- Add unique constraint to inventory to prevent duplicates
-- Drop constraint if exists, then add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_inventory_component'
    ) THEN
        ALTER TABLE inventory ADD CONSTRAINT unique_inventory_component UNIQUE (component_id);
    END IF;
END $$;

-- ============================================================================
-- PART 7: BACKFILL INVENTORY FOR EXISTING COMPONENTS
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

