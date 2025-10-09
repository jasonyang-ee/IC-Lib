-- ============================================================================
-- AllegroSQL Database Schema - OrCAD CIS Compatible
-- ============================================================================
-- PostgreSQL 18
-- Compatible with OrCAD CIS Version 17.2
-- This schema includes 11 category-specific tables that serve as the source
-- of truth for OrCAD CIS, plus a master components table for the web interface.
-- Bidirectional triggers keep both systems synchronized.
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PART 1: CORE CONFIGURATION TABLES
-- ============================================================================

-- Table: component_categories
-- Stores all component categories with CIS-compliant integer IDs
CREATE TABLE IF NOT EXISTS component_categories (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    table_name VARCHAR(100) UNIQUE NOT NULL,
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

-- ============================================================================
-- PART 2: MASTER COMPONENTS TABLE (For AllegroSQL Web Interface)
-- ============================================================================

-- Table: components (Master component table)
-- Aggregates all components from category tables for web interface
CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id INTEGER REFERENCES component_categories(id) ON DELETE CASCADE,
    part_number VARCHAR(255) UNIQUE NOT NULL,
    manufacturer_id UUID REFERENCES manufacturers(id),
    manufacturer_pn VARCHAR(255),
    description TEXT,
    value VARCHAR(255),
    pcb_footprint VARCHAR(500),
    package_size VARCHAR(100),
    datasheet_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'Active',
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- ============================================================================
-- PART 3: CATEGORY-SPECIFIC TABLES (OrCAD CIS Source Tables)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CAPACITORS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capacitors (
    -- Common Fields (CIS Required)
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    
    -- Package/Physical
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    
    -- CAD Integration
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    
    -- Simulation
    pspice_template TEXT,
    
    -- Documentation
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Capacitor-Specific Fields
    dielectric_type VARCHAR(100),
    equivalent_series_resistance VARCHAR(50),
    temperature_coefficient VARCHAR(50),
    tolerance VARCHAR(50),
    rated_voltage VARCHAR(50),
    
    -- Internal tracking
    category_id INTEGER DEFAULT 1,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. RESISTORS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resistors (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    
    -- Package/Physical
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    
    -- CAD Integration
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    
    -- Simulation
    pspice_template TEXT,
    
    -- Documentation
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Resistor-Specific Fields
    tolerance VARCHAR(50),
    power_rating VARCHAR(50),
    temperature_coefficient VARCHAR(50),
    resistance VARCHAR(50),
    resistor_type VARCHAR(100),
    
    -- Internal tracking
    category_id INTEGER DEFAULT 2,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3. ICS (INTEGRATED CIRCUITS) TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ics (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    
    -- Package/Physical
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    
    -- CAD Integration
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    
    -- Simulation
    pspice_template TEXT,
    
    -- Documentation
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- IC-Specific Fields
    ic_type VARCHAR(100),
    logic_family VARCHAR(100),
    pin_count VARCHAR(50),
    supply_voltage VARCHAR(50),
    interface_type VARCHAR(100),
    
    -- Internal tracking
    category_id INTEGER DEFAULT 3,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 4. DIODES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diodes (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    
    -- Package/Physical
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    
    -- CAD Integration
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    
    -- Simulation
    pspice_template TEXT,
    
    -- Documentation
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Diode-Specific Fields
    diode_type VARCHAR(100),
    forward_voltage VARCHAR(50),
    reverse_voltage VARCHAR(50),
    wavelength VARCHAR(50),
    color VARCHAR(50),
    
    -- Internal tracking
    category_id INTEGER DEFAULT 4,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 5. INDUCTORS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inductors (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    
    -- Package/Physical
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    
    -- CAD Integration
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    
    -- Simulation
    pspice_template TEXT,
    
    -- Documentation
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Inductor-Specific Fields
    inductance VARCHAR(50),
    tolerance VARCHAR(50),
    current_rating VARCHAR(50),
    dc_resistance VARCHAR(50),
    core_material VARCHAR(100),
    
    -- Internal tracking
    category_id INTEGER DEFAULT 5,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 6. CONNECTORS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connectors (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    
    -- Package/Physical
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    
    -- CAD Integration
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    
    -- Simulation
    pspice_template TEXT,
    
    -- Documentation
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Connector-Specific Fields
    contact_current VARCHAR(50),
    contact_gender VARCHAR(50),
    pitch VARCHAR(50),
    num_contacts VARCHAR(50),
    contact_plating VARCHAR(100),
    
    -- Internal tracking
    category_id INTEGER DEFAULT 6,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 7. CRYSTALS AND OSCILLATORS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crystals_and_oscillators (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    
    -- Package/Physical
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    
    -- CAD Integration
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    
    -- Simulation
    pspice_template TEXT,
    
    -- Documentation
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Crystal-Specific Fields
    frequency_tolerance VARCHAR(50),
    frequency_stability VARCHAR(50),
    load_capacitance VARCHAR(50),
    operating_mode VARCHAR(100),
    
    -- Internal tracking
    category_id INTEGER DEFAULT 7,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 8. RELAYS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relays (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    
    -- Package/Physical
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    
    -- CAD Integration
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    
    -- Simulation
    pspice_template TEXT,
    
    -- Documentation
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Relay-Specific Fields
    coil_voltage VARCHAR(50),
    coil_current VARCHAR(50),
    contact_configuration VARCHAR(100),
    switching_current VARCHAR(50),
    
    -- Internal tracking
    category_id INTEGER DEFAULT 8,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 9. SWITCHES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS switches (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    
    -- Package/Physical
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    
    -- CAD Integration
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    
    -- Simulation
    pspice_template TEXT,
    
    -- Documentation
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Switch-Specific Fields
    switch_type VARCHAR(100),
    contact_configuration VARCHAR(100),
    operating_force VARCHAR(50),
    
    -- Internal tracking
    category_id INTEGER DEFAULT 9,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 10. TRANSFORMERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transformers (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    
    -- Package/Physical
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    
    -- CAD Integration
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    
    -- Simulation
    pspice_template TEXT,
    
    -- Documentation
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Transformer-Specific Fields
    primary_voltage VARCHAR(50),
    secondary_voltage VARCHAR(50),
    turns_ratio VARCHAR(50),
    power_rating VARCHAR(50),
    
    -- Internal tracking
    category_id INTEGER DEFAULT 10,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 11. MISC TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS misc (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    
    -- Package/Physical
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    
    -- CAD Integration
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    
    -- Simulation
    pspice_template TEXT,
    
    -- Documentation
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Misc-Specific Fields
    component_type VARCHAR(100),
    
    -- Internal tracking
    category_id INTEGER DEFAULT 11,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PART 4: SUPPORTING TABLES
-- ============================================================================

-- Table: component_specifications
-- Stores technical specifications for components
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
-- Maps footprint information for tracking
CREATE TABLE IF NOT EXISTS footprint_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    source_type VARCHAR(50), -- e.g., 'ultra_librarian', 'snapeda', 'component_search_engine'
    footprint_url VARCHAR(500),
    downloaded BOOLEAN DEFAULT false,
    download_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PART 5: SYNCHRONIZATION TRIGGER FUNCTIONS
-- ============================================================================

-- Function: sync_category_to_components()
-- Synchronizes INSERT/UPDATE/DELETE from category tables to components table
CREATE OR REPLACE FUNCTION sync_category_to_components()
RETURNS TRIGGER AS $$
DECLARE
    v_manufacturer_id UUID;
    v_component_id UUID;
BEGIN
    -- Handle INSERT
    IF (TG_OP = 'INSERT') THEN
        -- Get or create manufacturer
        IF NEW.manufacturer IS NOT NULL AND NEW.manufacturer != '' THEN
            INSERT INTO manufacturers (name)
            VALUES (NEW.manufacturer)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id INTO v_manufacturer_id;
        END IF;
        
        -- Insert into components table
        INSERT INTO components (
            category_id,
            part_number,
            manufacturer_id,
            manufacturer_pn,
            description,
            value,
            pcb_footprint,
            package_size,
            datasheet_url,
            status,
            notes
        ) VALUES (
            NEW.category_id,
            NEW.part_number,
            v_manufacturer_id,
            NEW.manufacturer_pn,
            NEW.description,
            NEW.value,
            NEW.pcb_footprint,
            NEW.package_size,
            NEW.datasheet_url,
            NEW.company_part_status,
            NEW.notes
        );
        
        RETURN NEW;
    END IF;
    
    -- Handle UPDATE
    IF (TG_OP = 'UPDATE') THEN
        -- Get or create manufacturer
        IF NEW.manufacturer IS NOT NULL AND NEW.manufacturer != '' THEN
            INSERT INTO manufacturers (name)
            VALUES (NEW.manufacturer)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id INTO v_manufacturer_id;
        END IF;
        
        -- Update components table
        UPDATE components SET
            manufacturer_id = v_manufacturer_id,
            manufacturer_pn = NEW.manufacturer_pn,
            description = NEW.description,
            value = NEW.value,
            pcb_footprint = NEW.pcb_footprint,
            package_size = NEW.package_size,
            datasheet_url = NEW.datasheet_url,
            status = NEW.company_part_status,
            notes = NEW.notes,
            updated_at = CURRENT_TIMESTAMP
        WHERE part_number = NEW.part_number;
        
        RETURN NEW;
    END IF;
    
    -- Handle DELETE
    IF (TG_OP = 'DELETE') THEN
        DELETE FROM components WHERE part_number = OLD.part_number;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: sync_components_to_category()
-- Synchronizes INSERT/UPDATE/DELETE from components table to category tables
CREATE OR REPLACE FUNCTION sync_components_to_category()
RETURNS TRIGGER AS $$
DECLARE
    v_table_name VARCHAR(100);
    v_manufacturer_name VARCHAR(255);
    v_query TEXT;
BEGIN
    -- Get table name from category_id
    SELECT table_name INTO v_table_name
    FROM component_categories
    WHERE id = NEW.category_id;
    
    IF v_table_name IS NULL THEN
        RAISE EXCEPTION 'Invalid category_id: %', NEW.category_id;
    END IF;
    
    -- Get manufacturer name
    SELECT name INTO v_manufacturer_name
    FROM manufacturers
    WHERE id = NEW.manufacturer_id;
    
    -- Handle INSERT
    IF (TG_OP = 'INSERT') THEN
        v_query := format(
            'INSERT INTO %I (part_number, manufacturer, manufacturer_pn, description, value, 
             pcb_footprint, package_size, datasheet_url, company_part_status, notes, category_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (part_number) DO NOTHING',
            v_table_name
        );
        
        EXECUTE v_query USING
            NEW.part_number,
            v_manufacturer_name,
            NEW.manufacturer_pn,
            NEW.description,
            NEW.value,
            NEW.pcb_footprint,
            NEW.package_size,
            NEW.datasheet_url,
            NEW.status,
            NEW.notes,
            NEW.category_id;
            
        RETURN NEW;
    END IF;
    
    -- Handle UPDATE
    IF (TG_OP = 'UPDATE') THEN
        -- If category changed, move to new table
        IF OLD.category_id != NEW.category_id THEN
            -- Delete from old table
            SELECT table_name INTO v_table_name
            FROM component_categories
            WHERE id = OLD.category_id;
            
            v_query := format('DELETE FROM %I WHERE part_number = $1', v_table_name);
            EXECUTE v_query USING OLD.part_number;
            
            -- Insert into new table
            SELECT table_name INTO v_table_name
            FROM component_categories
            WHERE id = NEW.category_id;
            
            v_query := format(
                'INSERT INTO %I (part_number, manufacturer, manufacturer_pn, description, value,
                 pcb_footprint, package_size, datasheet_url, company_part_status, notes, category_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                v_table_name
            );
            
            EXECUTE v_query USING
                NEW.part_number,
                v_manufacturer_name,
                NEW.manufacturer_pn,
                NEW.description,
                NEW.value,
                NEW.pcb_footprint,
                NEW.package_size,
                NEW.datasheet_url,
                NEW.status,
                NEW.notes,
                NEW.category_id;
        ELSE
            -- Update in same table
            v_query := format(
                'UPDATE %I SET manufacturer = $1, manufacturer_pn = $2, description = $3,
                 value = $4, pcb_footprint = $5, package_size = $6, datasheet_url = $7,
                 company_part_status = $8, notes = $9, updated_at = CURRENT_TIMESTAMP
                 WHERE part_number = $10',
                v_table_name
            );
            
            EXECUTE v_query USING
                v_manufacturer_name,
                NEW.manufacturer_pn,
                NEW.description,
                NEW.value,
                NEW.pcb_footprint,
                NEW.package_size,
                NEW.datasheet_url,
                NEW.status,
                NEW.notes,
                NEW.part_number;
        END IF;
        
        RETURN NEW;
    END IF;
    
    -- Handle DELETE
    IF (TG_OP = 'DELETE') THEN
        SELECT table_name INTO v_table_name
        FROM component_categories
        WHERE id = OLD.category_id;
        
        v_query := format('DELETE FROM %I WHERE part_number = $1', v_table_name);
        EXECUTE v_query USING OLD.part_number;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 6: CREATE TRIGGERS FOR ALL CATEGORY TABLES
-- ============================================================================

-- Capacitors triggers
CREATE TRIGGER trg_capacitors_to_components
    AFTER INSERT OR UPDATE OR DELETE ON capacitors
    FOR EACH ROW EXECUTE FUNCTION sync_category_to_components();

-- Resistors triggers
CREATE TRIGGER trg_resistors_to_components
    AFTER INSERT OR UPDATE OR DELETE ON resistors
    FOR EACH ROW EXECUTE FUNCTION sync_category_to_components();

-- ICs triggers
CREATE TRIGGER trg_ics_to_components
    AFTER INSERT OR UPDATE OR DELETE ON ics
    FOR EACH ROW EXECUTE FUNCTION sync_category_to_components();

-- Diodes triggers
CREATE TRIGGER trg_diodes_to_components
    AFTER INSERT OR UPDATE OR DELETE ON diodes
    FOR EACH ROW EXECUTE FUNCTION sync_category_to_components();

-- Inductors triggers
CREATE TRIGGER trg_inductors_to_components
    AFTER INSERT OR UPDATE OR DELETE ON inductors
    FOR EACH ROW EXECUTE FUNCTION sync_category_to_components();

-- Connectors triggers
CREATE TRIGGER trg_connectors_to_components
    AFTER INSERT OR UPDATE OR DELETE ON connectors
    FOR EACH ROW EXECUTE FUNCTION sync_category_to_components();

-- Crystals and Oscillators triggers
CREATE TRIGGER trg_crystals_to_components
    AFTER INSERT OR UPDATE OR DELETE ON crystals_and_oscillators
    FOR EACH ROW EXECUTE FUNCTION sync_category_to_components();

-- Relays triggers
CREATE TRIGGER trg_relays_to_components
    AFTER INSERT OR UPDATE OR DELETE ON relays
    FOR EACH ROW EXECUTE FUNCTION sync_category_to_components();

-- Switches triggers
CREATE TRIGGER trg_switches_to_components
    AFTER INSERT OR UPDATE OR DELETE ON switches
    FOR EACH ROW EXECUTE FUNCTION sync_category_to_components();

-- Transformers triggers
CREATE TRIGGER trg_transformers_to_components
    AFTER INSERT OR UPDATE OR DELETE ON transformers
    FOR EACH ROW EXECUTE FUNCTION sync_category_to_components();

-- Misc triggers
CREATE TRIGGER trg_misc_to_components
    AFTER INSERT OR UPDATE OR DELETE ON misc
    FOR EACH ROW EXECUTE FUNCTION sync_category_to_components();

-- Components to category tables trigger
CREATE TRIGGER trg_components_to_category
    AFTER INSERT OR UPDATE OR DELETE ON components
    FOR EACH ROW EXECUTE FUNCTION sync_components_to_category();

-- ============================================================================
-- PART 7: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Components table indexes
CREATE INDEX idx_components_category ON components(category_id);
CREATE INDEX idx_components_manufacturer ON components(manufacturer_id);
CREATE INDEX idx_components_part_number ON components(part_number);
CREATE INDEX idx_components_status ON components(status);

-- Category table indexes (part_number is already PRIMARY KEY)
CREATE INDEX idx_capacitors_manufacturer ON capacitors(manufacturer);
CREATE INDEX idx_capacitors_value ON capacitors(value);
CREATE INDEX idx_resistors_manufacturer ON resistors(manufacturer);
CREATE INDEX idx_resistors_value ON resistors(value);
CREATE INDEX idx_ics_manufacturer ON ics(manufacturer);
CREATE INDEX idx_diodes_manufacturer ON diodes(manufacturer);
CREATE INDEX idx_inductors_manufacturer ON inductors(manufacturer);
CREATE INDEX idx_connectors_manufacturer ON connectors(manufacturer);
CREATE INDEX idx_crystals_manufacturer ON crystals_and_oscillators(manufacturer);
CREATE INDEX idx_relays_manufacturer ON relays(manufacturer);
CREATE INDEX idx_switches_manufacturer ON switches(manufacturer);
CREATE INDEX idx_transformers_manufacturer ON transformers(manufacturer);
CREATE INDEX idx_misc_manufacturer ON misc(manufacturer);

-- Supporting table indexes
CREATE INDEX idx_component_specs_component ON component_specifications(component_id);
CREATE INDEX idx_distributor_info_component ON distributor_info(component_id);
CREATE INDEX idx_distributor_info_distributor ON distributor_info(distributor_id);
CREATE INDEX idx_inventory_component ON inventory(component_id);
CREATE INDEX idx_footprint_sources_component ON footprint_sources(component_id);

-- ============================================================================
-- PART 8: TIMESTAMP UPDATE TRIGGER
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to components table
CREATE TRIGGER update_components_updated_at 
    BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to all category tables
CREATE TRIGGER update_capacitors_updated_at 
    BEFORE UPDATE ON capacitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resistors_updated_at 
    BEFORE UPDATE ON resistors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ics_updated_at 
    BEFORE UPDATE ON ics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_diodes_updated_at 
    BEFORE UPDATE ON diodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inductors_updated_at 
    BEFORE UPDATE ON inductors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connectors_updated_at 
    BEFORE UPDATE ON connectors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crystals_updated_at 
    BEFORE UPDATE ON crystals_and_oscillators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_relays_updated_at 
    BEFORE UPDATE ON relays
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_switches_updated_at 
    BEFORE UPDATE ON switches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transformers_updated_at 
    BEFORE UPDATE ON transformers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_misc_updated_at 
    BEFORE UPDATE ON misc
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to supporting tables
CREATE TRIGGER update_inventory_updated_at 
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at 
    BEFORE UPDATE ON component_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 9: INSERT DEFAULT DATA
-- ============================================================================

-- Insert component categories with CIS-compliant integer IDs
INSERT INTO component_categories (id, name, description, table_name) VALUES
    (1, 'Capacitor', 'Capacitors of all types', 'capacitors'),
    (2, 'Resistor', 'Fixed and variable resistors', 'resistors'),
    (3, 'IC', 'Integrated circuits', 'ics'),
    (4, 'Diode', 'Diodes and LEDs', 'diodes'),
    (5, 'Inductor', 'Inductors and chokes', 'inductors'),
    (6, 'Connector', 'Connectors and terminals', 'connectors'),
    (7, 'Crystal/Oscillator', 'Crystals and oscillators', 'crystals_and_oscillators'),
    (8, 'Relay', 'Electromechanical relays', 'relays'),
    (9, 'Switch', 'Switches and buttons', 'switches'),
    (10, 'Transformer', 'Transformers', 'transformers'),
    (11, 'Misc', 'Miscellaneous components', 'misc')
ON CONFLICT (id) DO NOTHING;

-- Insert default distributors
INSERT INTO distributors (name, api_endpoint) VALUES
    ('Digikey', 'https://api.digikey.com'),
    ('Mouser', 'https://api.mouser.com'),
    ('Arrow', 'https://api.arrow.com')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
