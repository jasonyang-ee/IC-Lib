-- ============================================================================
-- IC-Lib Default Settings Data
-- ============================================================================
-- This file contains initial configuration data (categories, distributors,
-- category specifications, and ECO defaults). Separated from init-schema.sql
-- so it can be run independently via "Init Categories" in the admin UI.
-- All INSERTs use ON CONFLICT DO NOTHING so this file is safe to run repeatedly.
-- ============================================================================

-- ============================================================================
-- Default Component Categories
-- ============================================================================

INSERT INTO component_categories (name, description, prefix, leading_zeros, display_order) VALUES
    ('Capacitor', 'Capacitors and capacitor arrays', 'CAP', 5, 1),
    ('Resistor', 'Resistors and resistor arrays', 'RES', 5, 2),
    ('Inductor', 'Inductors and coils', 'IND', 5, 3),
    ('Diode', 'Diodes, LEDs, and rectifiers', 'DIODE', 5, 4),
    ('Transistor', 'BJTs, MOSFETs, and other transistors', 'FET', 5, 5),
    ('IC', 'Integrated circuits', 'IC', 5, 6),
    ('Connector', 'Connectors and headers', 'CONN', 5, 7),
    ('Switch', 'Switches and buttons', 'SW', 5, 8),
    ('Oscillator', 'Crystals, oscillators, and resonators', 'XTAL', 5, 9),
    ('MCU', 'Microcontroller', 'IC', 5, 10),
    ('Mechanical', 'Mechanical Parts', 'MECH', 5, 11),
    ('Misc', 'Miscellaneous Parts', 'MISC', 5, 12),
    ('Relay', 'Relays', 'RELAY', 5, 13),
    ('Transformer', 'Transformers', 'TRNS', 5, 14)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Default Distributors
-- ============================================================================

INSERT INTO distributors (name, api_endpoint) VALUES
    ('Digikey', 'https://api.digikey.com/v1'),
    ('Mouser', 'https://api.mouser.com/api/v1'),
    ('Newark', 'https://api.newark.com/v1'),
    ('Arrow', 'https://api.arrow.com/v1')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Default ECO Approval Stage
-- ============================================================================

INSERT INTO eco_approval_stages (stage_name, stage_order, required_approvals, required_role)
SELECT 'Review & Approval', 1, 1, 'approver'
WHERE NOT EXISTS (SELECT 1 FROM eco_approval_stages);

-- ============================================================================
-- Default ECO Settings
-- ============================================================================

INSERT INTO eco_settings (prefix, leading_zeros, next_number)
SELECT 'ECO-', 6, 1
WHERE NOT EXISTS (SELECT 1 FROM eco_settings);

-- ============================================================================
-- Default Admin Settings
-- ============================================================================

-- Ensure the admin_settings table exists (for standalone init-settings runs)
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    global_prefix_enabled BOOLEAN NOT NULL DEFAULT false,
    global_prefix VARCHAR(20) NOT NULL DEFAULT '',
    global_leading_zeros INTEGER NOT NULL DEFAULT 5,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_settings_singleton ON admin_settings((1));

INSERT INTO admin_settings (global_prefix_enabled, global_prefix, global_leading_zeros)
SELECT false, '', 5
WHERE NOT EXISTS (SELECT 1 FROM admin_settings);

-- ============================================================================
-- Default Category Specifications (Master Spec Definitions)
-- ============================================================================

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
    SELECT id INTO cap_id FROM component_categories WHERE name = 'Capacitor';
    SELECT id INTO res_id FROM component_categories WHERE name = 'Resistor';
    SELECT id INTO ind_id FROM component_categories WHERE name = 'Inductor';
    SELECT id INTO dio_id FROM component_categories WHERE name = 'Diode';
    SELECT id INTO tra_id FROM component_categories WHERE name = 'Transistor';
    SELECT id INTO ic_id FROM component_categories WHERE name = 'IC';
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
