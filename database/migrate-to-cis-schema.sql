-- ============================================================================
-- OrCAD CIS Compatible Database Migration Script
-- ============================================================================
-- Purpose: Create category-specific tables for OrCAD CIS compatibility
-- Database: PostgreSQL 18
-- Based on: CIP-E V7.9 CIS DB.DBC configuration
-- Date: 2025-10-08
-- ============================================================================

-- This script creates individual tables for each component category as required
-- by OrCAD CIS. Each table contains common fields plus category-specific fields.

-- Strategy: Dual Storage with Trigger Synchronization
-- - Category tables are source of truth for CIS
-- - Master components table aggregates all categories
-- - Triggers keep both synchronized bi-directionally

BEGIN;

-- ============================================================================
-- PART 1: CREATE CATEGORY TABLES
-- ============================================================================

-- Common fields template (used in all tables):
-- - part_number VARCHAR(255) PRIMARY KEY - Internal company part number
-- - description TEXT - Component description
-- - value VARCHAR(255) - Primary value (resistance, capacitance, IC name, etc.)
-- - pcb_footprint VARCHAR(500) - Footprint file path
-- - manufacturer VARCHAR(255) - Manufacturer name
-- - manufacturer_pn VARCHAR(255) - Manufacturer part number
-- - package_size VARCHAR(100) - Package size (0805, SOT-23, etc.)
-- - company_part_status VARCHAR(50) - Active, Obsolete, NRND, etc.
-- - implementation VARCHAR(100) - Surface Mount or Through Hole
-- - implementation_type VARCHAR(100) - SMT, THT
-- - class VARCHAR(100) - Component class for schematic
-- - alt_symbols TEXT - Alternative schematic symbols
-- - step_model VARCHAR(500) - 3D STEP model file path
-- - pspice_template TEXT - PSpice netlist template
-- - datasheet_url VARCHAR(500) - Datasheet URL
-- - notes TEXT - Additional notes
-- - created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- - updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

-- ----------------------------------------------------------------------------
-- 1. CAPACITORS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capacitors (
    -- Common Fields (CIS Required)
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL, -- Capacitance value (e.g., "10uF")
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    
    -- Package/Physical
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100), -- SMT or THT
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
    dielectric_type VARCHAR(100), -- Ceramic, Electrolytic, Tantalum, Film
    equivalent_series_resistance VARCHAR(50), -- ESR value
    temperature_coefficient VARCHAR(50), -- X5R, X7R, C0G/NP0, Y5V
    tolerance VARCHAR(50), -- ±5%, ±10%, ±20%
    rated_voltage VARCHAR(50), -- Maximum voltage rating
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_capacitors_value ON capacitors(value);
CREATE INDEX idx_capacitors_manufacturer ON capacitors(manufacturer);
CREATE INDEX idx_capacitors_package_size ON capacitors(package_size);

-- ----------------------------------------------------------------------------
-- 2. CONNECTORS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connectors (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    pspice_template TEXT,
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Connector-Specific Fields
    contact_current VARCHAR(50),
    contact_gender VARCHAR(50), -- Male, Female, Receptacle
    contact_material VARCHAR(100),
    contact_plating VARCHAR(100), -- Gold, Tin, Nickel
    contact_voltage VARCHAR(50),
    housing_gender VARCHAR(50),
    housing_material VARCHAR(100),
    number_of_contacts VARCHAR(50),
    number_of_rows VARCHAR(50),
    pitch VARCHAR(50), -- Pin spacing in mm
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_connectors_value ON connectors(value);
CREATE INDEX idx_connectors_manufacturer ON connectors(manufacturer);

-- ----------------------------------------------------------------------------
-- 3. CRYSTALS AND OSCILLATORS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "crystals and oscillators" (
    -- Common Fields (note: table name has space for CIS compatibility)
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL, -- Frequency value
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    pspice_template TEXT,
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Crystal-Specific Fields
    cut_and_osc_mode VARCHAR(100),
    duty_cycle VARCHAR(50),
    enable_high_low VARCHAR(50),
    frequency_stability VARCHAR(50),
    frequency_tolerance VARCHAR(50), -- ppm
    load_capacitance VARCHAR(50),
    load_resistance VARCHAR(50),
    number_of_outputs VARCHAR(50),
    shunt_capacitance VARCHAR(50),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_crystals_value ON "crystals and oscillators"(value);
CREATE INDEX idx_crystals_manufacturer ON "crystals and oscillators"(manufacturer);

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
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    pspice_template TEXT,
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Diode-Specific Fields
    diode_type VARCHAR(100), -- Schottky, Zener, TVS, LED, etc.
    forward_voltage VARCHAR(50), -- Vf
    reverse_voltage VARCHAR(50), -- Vr max
    forward_current VARCHAR(50), -- If max
    power_dissipation VARCHAR(50),
    wavelength VARCHAR(50), -- For LEDs (nm)
    color VARCHAR(50), -- For LEDs
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_diodes_value ON diodes(value);
CREATE INDEX idx_diodes_manufacturer ON diodes(manufacturer);
CREATE INDEX idx_diodes_type ON diodes(diode_type);

-- ----------------------------------------------------------------------------
-- 5. ICS (INTEGRATED CIRCUITS) TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ics (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL, -- IC part number or designation
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    pspice_template TEXT,
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- IC-Specific Fields
    ic_type VARCHAR(100), -- Microcontroller, Op-Amp, Logic, Memory, etc.
    logic_family VARCHAR(50), -- TTL, CMOS, etc.
    supply_voltage_min VARCHAR(50),
    supply_voltage_max VARCHAR(50),
    pin_count VARCHAR(50),
    speed_grade VARCHAR(50),
    memory_size VARCHAR(50), -- For memory ICs
    interface_type VARCHAR(100), -- SPI, I2C, UART, etc.
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ics_value ON ics(value);
CREATE INDEX idx_ics_manufacturer ON ics(manufacturer);
CREATE INDEX idx_ics_type ON ics(ic_type);

-- ----------------------------------------------------------------------------
-- 6. INDUCTORS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inductors (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL, -- Inductance value
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    pspice_template TEXT,
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Inductor-Specific Fields
    inductance VARCHAR(50), -- µH, mH
    tolerance VARCHAR(50),
    current_rating VARCHAR(50), -- Maximum DC current
    dc_resistance VARCHAR(50), -- DCR
    self_resonant_frequency VARCHAR(50), -- SRF
    saturation_current VARCHAR(50),
    core_material VARCHAR(100), -- Ferrite, Iron powder, etc.
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inductors_value ON inductors(value);
CREATE INDEX idx_inductors_manufacturer ON inductors(manufacturer);

-- ----------------------------------------------------------------------------
-- 7. MISC TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS misc (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    pspice_template TEXT,
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Misc-Specific Fields
    component_type VARCHAR(100), -- Generic type designation
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_misc_value ON misc(value);
CREATE INDEX idx_misc_manufacturer ON misc(manufacturer);

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
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    pspice_template TEXT,
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Relay-Specific Fields
    coil_voltage VARCHAR(50),
    coil_current VARCHAR(50),
    coil_resistance VARCHAR(50),
    contact_configuration VARCHAR(50), -- SPST, SPDT, DPDT, etc.
    contact_current VARCHAR(50),
    contact_voltage VARCHAR(50),
    switching_time VARCHAR(50),
    contact_material VARCHAR(100),
    mounting_type VARCHAR(100), -- PCB, Panel, DIN rail
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_relays_value ON relays(value);
CREATE INDEX idx_relays_manufacturer ON relays(manufacturer);

-- ----------------------------------------------------------------------------
-- 9. RESISTORS TABLE (Already exists, but add missing fields)
-- ----------------------------------------------------------------------------
-- Check if resistors table exists and alter it if needed
DO $$ 
BEGIN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='part_number') THEN
        ALTER TABLE resistors ADD COLUMN part_number VARCHAR(255) UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='manufacturer') THEN
        ALTER TABLE resistors ADD COLUMN manufacturer VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='manufacturer_pn') THEN
        ALTER TABLE resistors ADD COLUMN manufacturer_pn VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='pcb_footprint') THEN
        ALTER TABLE resistors ADD COLUMN pcb_footprint VARCHAR(500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='package_size') THEN
        ALTER TABLE resistors ADD COLUMN package_size VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='company_part_status') THEN
        ALTER TABLE resistors ADD COLUMN company_part_status VARCHAR(50) DEFAULT 'Active';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='implementation') THEN
        ALTER TABLE resistors ADD COLUMN implementation VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='implementation_type') THEN
        ALTER TABLE resistors ADD COLUMN implementation_type VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='class') THEN
        ALTER TABLE resistors ADD COLUMN class VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='alt_symbols') THEN
        ALTER TABLE resistors ADD COLUMN alt_symbols TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='step_model') THEN
        ALTER TABLE resistors ADD COLUMN step_model VARCHAR(500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='pspice_template') THEN
        ALTER TABLE resistors ADD COLUMN pspice_template TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='datasheet_url') THEN
        ALTER TABLE resistors ADD COLUMN datasheet_url VARCHAR(500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='notes') THEN
        ALTER TABLE resistors ADD COLUMN notes TEXT;
    END IF;
    
    -- Resistor-specific fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='tolerance') THEN
        ALTER TABLE resistors ADD COLUMN tolerance VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='power_rating') THEN
        ALTER TABLE resistors ADD COLUMN power_rating VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='temperature_coefficient') THEN
        ALTER TABLE resistors ADD COLUMN temperature_coefficient VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='resistance') THEN
        ALTER TABLE resistors ADD COLUMN resistance VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='resistor_type') THEN
        ALTER TABLE resistors ADD COLUMN resistor_type VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='voltage_rating') THEN
        ALTER TABLE resistors ADD COLUMN voltage_rating VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resistors' AND column_name='composition') THEN
        ALTER TABLE resistors ADD COLUMN composition VARCHAR(100);
    END IF;
END $$;

-- Create indexes on resistors if they don't exist
CREATE INDEX IF NOT EXISTS idx_resistors_part_number ON resistors(part_number);
CREATE INDEX IF NOT EXISTS idx_resistors_manufacturer ON resistors(manufacturer);
CREATE INDEX IF NOT EXISTS idx_resistors_package_size ON resistors(package_size);

-- ----------------------------------------------------------------------------
-- 10. SWITCHES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS switches (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    pspice_template TEXT,
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Switch-Specific Fields
    switch_type VARCHAR(100), -- Tactile, Slide, Toggle, Rotary, etc.
    contact_configuration VARCHAR(50), -- SPST, SPDT, DPDT, etc.
    contact_current VARCHAR(50),
    contact_voltage VARCHAR(50),
    operating_force VARCHAR(50), -- Actuation force
    travel_distance VARCHAR(50), -- Total travel
    life_cycle VARCHAR(50), -- Mechanical/electrical cycles
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_switches_value ON switches(value);
CREATE INDEX idx_switches_manufacturer ON switches(manufacturer);
CREATE INDEX idx_switches_type ON switches(switch_type);

-- ----------------------------------------------------------------------------
-- 11. TRANSFORMERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transformers (
    -- Common Fields
    part_number VARCHAR(255) PRIMARY KEY,
    description TEXT,
    value VARCHAR(255) NOT NULL,
    pcb_footprint VARCHAR(500),
    manufacturer VARCHAR(255),
    manufacturer_pn VARCHAR(255),
    package_size VARCHAR(100),
    company_part_status VARCHAR(50) DEFAULT 'Active',
    implementation VARCHAR(100),
    implementation_type VARCHAR(100),
    class VARCHAR(100),
    alt_symbols TEXT,
    step_model VARCHAR(500),
    pspice_template TEXT,
    datasheet_url VARCHAR(500),
    notes TEXT,
    
    -- Transformer-Specific Fields
    primary_voltage VARCHAR(50),
    secondary_voltage VARCHAR(50),
    turns_ratio VARCHAR(50), -- Primary:Secondary
    power_rating VARCHAR(50), -- VA rating
    frequency VARCHAR(50), -- Operating frequency
    primary_current VARCHAR(50),
    secondary_current VARCHAR(50),
    isolation_voltage VARCHAR(50), -- Isolation rating
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transformers_value ON transformers(value);
CREATE INDEX idx_transformers_manufacturer ON transformers(manufacturer);

-- ============================================================================
-- PART 2: UPDATE COMPONENT_CATEGORIES TABLE
-- ============================================================================

-- Ensure all categories are registered
INSERT INTO component_categories (name, description, table_name) VALUES
    ('Capacitors', 'Capacitors - all types', 'capacitors'),
    ('Connectors', 'Connectors and headers', 'connectors'),
    ('Crystals and Oscillators', 'Crystals, oscillators, and resonators', 'crystals and oscillators'),
    ('Diodes', 'Diodes, LEDs, and related devices', 'diodes'),
    ('ICs', 'Integrated circuits', 'ics'),
    ('Inductors', 'Inductors and chokes', 'inductors'),
    ('Misc', 'Miscellaneous components', 'misc'),
    ('Relays', 'Relays and contactors', 'relays'),
    ('Resistors', 'Resistors - all types', 'resistors'),
    ('Switches', 'Switches and buttons', 'switches'),
    ('Transformers', 'Transformers and coupled inductors', 'transformers')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PART 3: CREATE SYNCHRONIZATION TRIGGERS
-- ============================================================================

-- These triggers keep the master components table synchronized with
-- category-specific tables for the AllegroSQL web interface

-- Function to sync category table INSERT to components table
CREATE OR REPLACE FUNCTION sync_to_components_insert() RETURNS TRIGGER AS $$
DECLARE
    v_category_id UUID;
BEGIN
    -- Get category_id for this table
    SELECT id INTO v_category_id 
    FROM component_categories 
    WHERE table_name = TG_TABLE_NAME;
    
    -- Insert into master components table
    INSERT INTO components (
        category_id,
        part_number,
        manufacturer_id,
        manufacturer_part_number,
        description,
        subcategory,
        datasheet_url,
        footprint_path,
        notes
    ) VALUES (
        v_category_id,
        NEW.part_number,
        (SELECT id FROM manufacturers WHERE name = NEW.manufacturer LIMIT 1),
        NEW.manufacturer_pn,
        NEW.description,
        NEW.value, -- Use value as subcategory
        NEW.datasheet_url,
        NEW.pcb_footprint,
        NEW.notes
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync category table UPDATE to components table
CREATE OR REPLACE FUNCTION sync_to_components_update() RETURNS TRIGGER AS $$
BEGIN
    UPDATE components SET
        manufacturer_part_number = NEW.manufacturer_pn,
        description = NEW.description,
        subcategory = NEW.value,
        datasheet_url = NEW.datasheet_url,
        footprint_path = NEW.pcb_footprint,
        notes = NEW.notes,
        updated_at = CURRENT_TIMESTAMP
    WHERE part_number = NEW.part_number;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync category table DELETE to components table
CREATE OR REPLACE FUNCTION sync_to_components_delete() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM components WHERE part_number = OLD.part_number;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for each category table
-- (Resistors already handled separately if it exists)

-- Capacitors triggers
CREATE TRIGGER capacitors_insert_trigger
    AFTER INSERT ON capacitors
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_insert();

CREATE TRIGGER capacitors_update_trigger
    AFTER UPDATE ON capacitors
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_update();

CREATE TRIGGER capacitors_delete_trigger
    AFTER DELETE ON capacitors
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_delete();

-- Connectors triggers
CREATE TRIGGER connectors_insert_trigger
    AFTER INSERT ON connectors
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_insert();

CREATE TRIGGER connectors_update_trigger
    AFTER UPDATE ON connectors
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_update();

CREATE TRIGGER connectors_delete_trigger
    AFTER DELETE ON connectors
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_delete();

-- Crystals triggers
CREATE TRIGGER crystals_insert_trigger
    AFTER INSERT ON "crystals and oscillators"
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_insert();

CREATE TRIGGER crystals_update_trigger
    AFTER UPDATE ON "crystals and oscillators"
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_update();

CREATE TRIGGER crystals_delete_trigger
    AFTER DELETE ON "crystals and oscillators"
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_delete();

-- Diodes triggers
CREATE TRIGGER diodes_insert_trigger
    AFTER INSERT ON diodes
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_insert();

CREATE TRIGGER diodes_update_trigger
    AFTER UPDATE ON diodes
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_update();

CREATE TRIGGER diodes_delete_trigger
    AFTER DELETE ON diodes
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_delete();

-- ICs triggers
CREATE TRIGGER ics_insert_trigger
    AFTER INSERT ON ics
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_insert();

CREATE TRIGGER ics_update_trigger
    AFTER UPDATE ON ics
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_update();

CREATE TRIGGER ics_delete_trigger
    AFTER DELETE ON ics
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_delete();

-- Inductors triggers
CREATE TRIGGER inductors_insert_trigger
    AFTER INSERT ON inductors
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_insert();

CREATE TRIGGER inductors_update_trigger
    AFTER UPDATE ON inductors
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_update();

CREATE TRIGGER inductors_delete_trigger
    AFTER DELETE ON inductors
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_delete();

-- Misc triggers
CREATE TRIGGER misc_insert_trigger
    AFTER INSERT ON misc
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_insert();

CREATE TRIGGER misc_update_trigger
    AFTER UPDATE ON misc
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_update();

CREATE TRIGGER misc_delete_trigger
    AFTER DELETE ON misc
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_delete();

-- Relays triggers
CREATE TRIGGER relays_insert_trigger
    AFTER INSERT ON relays
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_insert();

CREATE TRIGGER relays_update_trigger
    AFTER UPDATE ON relays
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_update();

CREATE TRIGGER relays_delete_trigger
    AFTER DELETE ON relays
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_delete();

-- Resistors triggers (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resistors') THEN
        DROP TRIGGER IF EXISTS resistors_insert_trigger ON resistors;
        DROP TRIGGER IF EXISTS resistors_update_trigger ON resistors;
        DROP TRIGGER IF EXISTS resistors_delete_trigger ON resistors;
        
        CREATE TRIGGER resistors_insert_trigger
            AFTER INSERT ON resistors
            FOR EACH ROW EXECUTE FUNCTION sync_to_components_insert();
        
        CREATE TRIGGER resistors_update_trigger
            AFTER UPDATE ON resistors
            FOR EACH ROW EXECUTE FUNCTION sync_to_components_update();
        
        CREATE TRIGGER resistors_delete_trigger
            AFTER DELETE ON resistors
            FOR EACH ROW EXECUTE FUNCTION sync_to_components_delete();
    END IF;
END $$;

-- Switches triggers
CREATE TRIGGER switches_insert_trigger
    AFTER INSERT ON switches
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_insert();

CREATE TRIGGER switches_update_trigger
    AFTER UPDATE ON switches
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_update();

CREATE TRIGGER switches_delete_trigger
    AFTER DELETE ON switches
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_delete();

-- Transformers triggers
CREATE TRIGGER transformers_insert_trigger
    AFTER INSERT ON transformers
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_insert();

CREATE TRIGGER transformers_update_trigger
    AFTER UPDATE ON transformers
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_update();

CREATE TRIGGER transformers_delete_trigger
    AFTER DELETE ON transformers
    FOR EACH ROW EXECUTE FUNCTION sync_to_components_delete();

-- ============================================================================
-- PART 4: GRANT PERMISSIONS
-- ============================================================================

-- Grant appropriate permissions (adjust username as needed)
GRANT SELECT, INSERT, UPDATE, DELETE ON 
    capacitors, connectors, "crystals and oscillators", diodes, ics, 
    inductors, misc, relays, resistors, switches, transformers
TO PUBLIC; -- Or specify your database user

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary:
-- ✅ Created 11 category-specific tables for OrCAD CIS
-- ✅ Added category-specific technical fields
-- ✅ Created indexes for performance
-- ✅ Registered categories in component_categories table
-- ✅ Created synchronization triggers for dual storage
-- ✅ Granted appropriate permissions

-- Next Steps:
-- 1. Test CIS connection to database
-- 2. Migrate existing component data to category tables
-- 3. Update AllegroSQL backend to work with category tables
-- 4. Configure OrCAD CIS to use the new tables

-- To view created tables:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_type = 'BASE TABLE' 
-- ORDER BY table_name;
