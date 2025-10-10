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
    (1, 'Capacitors', 'Capacitors and capacitor arrays', 'CAP', 5),
    (2, 'Resistors', 'Resistors and resistor arrays', 'RES', 5),
    (3, 'Inductors', 'Inductors and coils', 'IND', 5),
    (4, 'Diodes', 'Diodes, LEDs, and rectifiers', 'DIODE', 5),
    (5, 'Transistors', 'BJTs, MOSFETs, and other transistors', 'TRANS', 5),
    (6, 'ICs', 'Integrated circuits', 'IC', 5),
    (7, 'Connectors', 'Connectors and headers', 'CONN', 5),
    (8, 'Switches', 'Switches and buttons', 'SW', 5),
    (9, 'Relays', 'Relays and contactors', 'RELAY', 5),
    (10, 'Crystals & Oscillators', 'Crystals, oscillators, and resonators', 'XTAL', 5),
    (11, 'Transformers', 'Transformers and magnetic components', 'XFMR', 5),
    (12, 'Misc', 'Miscellaneous components', 'MISC', 5)
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

-- Table: component_specifications
-- Stores additional specifications as key-value pairs
CREATE TABLE IF NOT EXISTS component_specifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    spec_name VARCHAR(100) NOT NULL,
    spec_value VARCHAR(500),
    unit VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: distributor_info
-- Stores pricing and availability from different distributors
CREATE TABLE IF NOT EXISTS distributor_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
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
    UNIQUE(component_id, distributor_id, sku)
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

-- Component specifications indexes
CREATE INDEX IF NOT EXISTS idx_comp_specs_component ON component_specifications(component_id);
CREATE INDEX IF NOT EXISTS idx_comp_specs_name ON component_specifications(spec_name);

-- Distributor info indexes
CREATE INDEX IF NOT EXISTS idx_distributor_info_component ON distributor_info(component_id);
CREATE INDEX IF NOT EXISTS idx_distributor_info_distributor ON distributor_info(distributor_id);

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

-- ============================================================================
-- PART 6: HELPER FUNCTION FOR PART_TYPE
-- ============================================================================

-- Function to generate part_type string from category and subcategories
-- This replaces the generated column which cannot use subqueries
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
    
    -- Build part_type string
    IF v_category_name IS NOT NULL THEN
        v_part_type := v_category_name;
        
        IF p_sub_category1 IS NOT NULL THEN
            v_part_type := v_part_type || '/' || p_sub_category1;
            
            IF p_sub_category2 IS NOT NULL THEN
                v_part_type := v_part_type || '/' || p_sub_category2;
                
                IF p_sub_category3 IS NOT NULL THEN
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
    get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3) as part_type
FROM components c;

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
