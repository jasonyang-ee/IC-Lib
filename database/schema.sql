-- Allegro Component Library Database Schema
-- PostgreSQL 18

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: component_categories
-- Stores all component categories (Resistor, Capacitor, Inductor, etc.)
CREATE TABLE IF NOT EXISTS component_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    table_name VARCHAR(100) UNIQUE NOT NULL, -- Actual table name for this category
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: manufacturers
-- Stores manufacturer information
CREATE TABLE IF NOT EXISTS manufacturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
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

-- Table: components (Master component table)
-- Main table storing common component information
CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES component_categories(id) ON DELETE CASCADE,
    part_number VARCHAR(100) UNIQUE NOT NULL,
    manufacturer_id UUID REFERENCES manufacturers(id),
    manufacturer_part_number VARCHAR(100),
    description TEXT,
    subcategory VARCHAR(100),
    datasheet_url VARCHAR(500),
    
    -- CAD File Paths
    footprint_path VARCHAR(500),
    symbol_path VARCHAR(500),
    pad_path VARCHAR(500),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    notes TEXT
);

-- Table: component_specifications
-- Flexible key-value store for component specifications
-- This allows different components to have different specifications
CREATE TABLE IF NOT EXISTS component_specifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    spec_key VARCHAR(100) NOT NULL,
    spec_value TEXT,
    spec_unit VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(component_id, spec_key)
);

-- Table: distributor_info
-- Stores pricing and stock information from distributors
CREATE TABLE IF NOT EXISTS distributor_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    distributor_id UUID REFERENCES distributors(id) ON DELETE CASCADE,
    distributor_part_number VARCHAR(100),
    stock_quantity INTEGER DEFAULT 0,
    price_breaks JSONB, -- Store price breaks as JSON: [{"quantity": 1, "price": 1.50}, ...]
    currency VARCHAR(10) DEFAULT 'USD',
    product_url VARCHAR(500),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(component_id, distributor_id)
);

-- Table: inventory
-- Tracks in-house inventory
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    location VARCHAR(200),
    quantity INTEGER DEFAULT 0,
    minimum_quantity INTEGER DEFAULT 0,
    purchase_date DATE,
    purchase_price DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: footprint_sources
-- Tracks where footprints were downloaded from
CREATE TABLE IF NOT EXISTS footprint_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    source_name VARCHAR(100), -- 'Ultra Librarian', 'SnapEDA', 'Manual'
    download_url VARCHAR(500),
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_format VARCHAR(50) -- 'Allegro', 'STEP', etc.
);

-- Create indexes for better query performance
CREATE INDEX idx_components_category ON components(category_id);
CREATE INDEX idx_components_manufacturer ON components(manufacturer_id);
CREATE INDEX idx_components_part_number ON components(part_number);
CREATE INDEX idx_component_specs_component ON component_specifications(component_id);
CREATE INDEX idx_distributor_info_component ON distributor_info(component_id);
CREATE INDEX idx_inventory_component ON inventory(component_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON component_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default categories
INSERT INTO component_categories (name, description, table_name) VALUES
    ('Resistor', 'Fixed and variable resistors', 'resistors'),
    ('Capacitor', 'Various types of capacitors', 'capacitors'),
    ('Inductor', 'Inductors and chokes', 'inductors'),
    ('IC', 'Integrated circuits', 'ics'),
    ('Diode', 'Diodes and rectifiers', 'diodes'),
    ('Transistor', 'BJT, MOSFET, and other transistors', 'transistors'),
    ('Connector', 'Connectors and terminals', 'connectors'),
    ('Crystal', 'Crystals and oscillators', 'crystals')
ON CONFLICT (name) DO NOTHING;

-- Insert default distributors
INSERT INTO distributors (name, api_endpoint) VALUES
    ('Digikey', 'https://api.digikey.com/v1'),
    ('Mouser', 'https://api.mouser.com/api/v1')
ON CONFLICT (name) DO NOTHING;

-- Views for easier querying

-- View: component_full_details
-- Combines component with manufacturer and category information
CREATE OR REPLACE VIEW component_full_details AS
SELECT 
    c.id,
    c.part_number,
    c.manufacturer_part_number,
    c.description,
    c.subcategory,
    cat.name as category_name,
    m.name as manufacturer_name,
    c.footprint_path,
    c.symbol_path,
    c.pad_path,
    c.datasheet_url,
    c.created_at,
    c.updated_at
FROM components c
LEFT JOIN component_categories cat ON c.category_id = cat.id
LEFT JOIN manufacturers m ON c.manufacturer_id = m.id;

-- View: inventory_summary
-- Shows inventory with component details
CREATE OR REPLACE VIEW inventory_summary AS
SELECT 
    i.id,
    c.part_number,
    c.description,
    cat.name as category,
    m.name as manufacturer,
    i.quantity,
    i.minimum_quantity,
    i.location,
    i.purchase_date,
    i.purchase_price
FROM inventory i
JOIN components c ON i.component_id = c.id
LEFT JOIN component_categories cat ON c.category_id = cat.id
LEFT JOIN manufacturers m ON c.manufacturer_id = m.id;
