-- Sample Data for Allegro Component Library
-- Run this after the main schema.sql to populate with sample data

-- Insert sample manufacturers
INSERT INTO manufacturers (name, website) VALUES
    ('Texas Instruments', 'https://www.ti.com'),
    ('STMicroelectronics', 'https://www.st.com'),
    ('Microchip Technology', 'https://www.microchip.com'),
    ('Analog Devices', 'https://www.analog.com'),
    ('NXP Semiconductors', 'https://www.nxp.com'),
    ('Infineon Technologies', 'https://www.infineon.com'),
    ('Yageo', 'https://www.yageo.com'),
    ('Murata', 'https://www.murata.com'),
    ('TDK', 'https://www.tdk.com'),
    ('Vishay', 'https://www.vishay.com')
ON CONFLICT (name) DO NOTHING;

-- Insert sample components

-- Get category and manufacturer IDs (you'll need to replace these with actual UUIDs from your database)
DO $$
DECLARE
    cat_resistor UUID;
    cat_capacitor UUID;
    cat_ic UUID;
    mfr_ti UUID;
    mfr_yageo UUID;
    mfr_murata UUID;
    comp_id UUID;
BEGIN
    -- Get category IDs
    SELECT id INTO cat_resistor FROM component_categories WHERE name = 'Resistor';
    SELECT id INTO cat_capacitor FROM component_categories WHERE name = 'Capacitor';
    SELECT id INTO cat_ic FROM component_categories WHERE name = 'IC';
    
    -- Get manufacturer IDs
    SELECT id INTO mfr_ti FROM manufacturers WHERE name = 'Texas Instruments';
    SELECT id INTO mfr_yageo FROM manufacturers WHERE name = 'Yageo';
    SELECT id INTO mfr_murata FROM manufacturers WHERE name = 'Murata';

    -- Sample Resistors
    INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_part_number, description, subcategory)
    VALUES 
        (cat_resistor, 'RES-0805-10K', mfr_yageo, 'RC0805FR-0710KL', 'Resistor 10K Ohm 1% 1/8W 0805', 'Thick Film'),
        (cat_resistor, 'RES-0805-1K', mfr_yageo, 'RC0805FR-071KL', 'Resistor 1K Ohm 1% 1/8W 0805', 'Thick Film'),
        (cat_resistor, 'RES-0805-100', mfr_yageo, 'RC0805FR-07100RL', 'Resistor 100 Ohm 1% 1/8W 0805', 'Thick Film'),
        (cat_resistor, 'RES-1206-22K', mfr_yageo, 'RC1206FR-0722KL', 'Resistor 22K Ohm 1% 1/4W 1206', 'Thick Film'),
        (cat_resistor, 'RES-0603-4.7K', mfr_yageo, 'RC0603FR-074K7L', 'Resistor 4.7K Ohm 1% 1/10W 0603', 'Thick Film')
    RETURNING id INTO comp_id;

    -- Add specifications for last resistor
    INSERT INTO component_specifications (component_id, spec_key, spec_value, spec_unit) VALUES
        (comp_id, 'Resistance', '4.7', 'kΩ'),
        (comp_id, 'Tolerance', '1', '%'),
        (comp_id, 'Power', '0.1', 'W'),
        (comp_id, 'Temperature Coefficient', '±100', 'ppm/°C');

    -- Sample Capacitors
    INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_part_number, description, subcategory)
    VALUES 
        (cat_capacitor, 'CAP-0805-10UF', mfr_murata, 'GRM21BR61C106KE15L', 'Capacitor 10µF ±10% 16V X5R 0805', 'MLCC'),
        (cat_capacitor, 'CAP-0805-1UF', mfr_murata, 'GRM21BR61E105KA12L', 'Capacitor 1µF ±10% 25V X5R 0805', 'MLCC'),
        (cat_capacitor, 'CAP-0805-100NF', mfr_murata, 'GRM21BR71H104KA01L', 'Capacitor 100nF ±10% 50V X7R 0805', 'MLCC'),
        (cat_capacitor, 'CAP-0603-22PF', mfr_murata, 'GRM1885C1H220JA01D', 'Capacitor 22pF ±5% 50V C0G 0603', 'MLCC'),
        (cat_capacitor, 'CAP-1206-47UF', mfr_murata, 'GRM31CR60J476ME19L', 'Capacitor 47µF ±20% 6.3V X5R 1206', 'MLCC')
    RETURNING id INTO comp_id;

    -- Add specifications for last capacitor
    INSERT INTO component_specifications (component_id, spec_key, spec_value, spec_unit) VALUES
        (comp_id, 'Capacitance', '47', 'µF'),
        (comp_id, 'Tolerance', '±20', '%'),
        (comp_id, 'Voltage Rating', '6.3', 'V'),
        (comp_id, 'Dielectric', 'X5R', ''),
        (comp_id, 'Temperature Range', '-55 to +85', '°C');

    -- Sample ICs
    INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_part_number, description, subcategory)
    VALUES 
        (cat_ic, 'IC-LM358-SOIC8', mfr_ti, 'LM358DR', 'Op Amp Dual General Purpose ±16V 8-SOIC', 'Operational Amplifier'),
        (cat_ic, 'IC-LM324-SOIC14', mfr_ti, 'LM324DR', 'Op Amp Quad General Purpose ±16V 14-SOIC', 'Operational Amplifier'),
        (cat_ic, 'IC-TL072-SOIC8', mfr_ti, 'TL072CDR', 'Op Amp Dual JFET Input ±18V 8-SOIC', 'Operational Amplifier'),
        (cat_ic, 'IC-74HC595-SOIC16', mfr_ti, 'SN74HC595DR', 'Shift Register 8-Bit Serial-to-Parallel 16-SOIC', 'Logic IC'),
        (cat_ic, 'IC-NE555-SOIC8', mfr_ti, 'NE555DR', 'Timer Single Precision 8-SOIC', 'Timer')
    RETURNING id INTO comp_id;

    -- Add specifications for last IC
    INSERT INTO component_specifications (component_id, spec_key, spec_value, spec_unit) VALUES
        (comp_id, 'Package', 'SOIC-8', ''),
        (comp_id, 'Supply Voltage', '4.5-16', 'V'),
        (comp_id, 'Output Current', '200', 'mA'),
        (comp_id, 'Operating Temperature', '-40 to +105', '°C'),
        (comp_id, 'Number of Timers', '1', '');

    -- Add sample distributor info
    DECLARE
        dist_digikey UUID;
        dist_mouser UUID;
    BEGIN
        SELECT id INTO dist_digikey FROM distributors WHERE name = 'Digikey';
        SELECT id INTO dist_mouser FROM distributors WHERE name = 'Mouser';
        
        -- Add distributor info for a few components
        SELECT id INTO comp_id FROM components WHERE part_number = 'RES-0805-10K';
        INSERT INTO distributor_info (component_id, distributor_id, distributor_part_number, stock_quantity, price_breaks)
        VALUES (
            comp_id,
            dist_digikey,
            '311-10KARCT-ND',
            15000,
            '[{"quantity": 1, "price": 0.10}, {"quantity": 10, "price": 0.082}, {"quantity": 100, "price": 0.044}, {"quantity": 1000, "price": 0.0254}]'::jsonb
        );

        SELECT id INTO comp_id FROM components WHERE part_number = 'CAP-0805-10UF';
        INSERT INTO distributor_info (component_id, distributor_id, distributor_part_number, stock_quantity, price_breaks)
        VALUES (
            comp_id,
            dist_mouser,
            '81-GRM21BR61C106KE5L',
            25000,
            '[{"quantity": 1, "price": 0.29}, {"quantity": 10, "price": 0.198}, {"quantity": 100, "price": 0.099}, {"quantity": 1000, "price": 0.057}]'::jsonb
        );

        SELECT id INTO comp_id FROM components WHERE part_number = 'IC-LM358-SOIC8';
        INSERT INTO distributor_info (component_id, distributor_id, distributor_part_number, stock_quantity, price_breaks)
        VALUES (
            comp_id,
            dist_digikey,
            '296-1395-5-ND',
            18500,
            '[{"quantity": 1, "price": 0.58}, {"quantity": 10, "price": 0.442}, {"quantity": 100, "price": 0.308}, {"quantity": 1000, "price": 0.184}]'::jsonb
        );
    END;

    -- Add sample inventory
    INSERT INTO inventory (component_id, location, quantity, minimum_quantity, purchase_date, purchase_price)
    VALUES 
        ((SELECT id FROM components WHERE part_number = 'RES-0805-10K'), 'Drawer A-1', 500, 100, CURRENT_DATE - INTERVAL '30 days', 0.044),
        ((SELECT id FROM components WHERE part_number = 'RES-0805-1K'), 'Drawer A-1', 450, 100, CURRENT_DATE - INTERVAL '30 days', 0.041),
        ((SELECT id FROM components WHERE part_number = 'CAP-0805-10UF'), 'Drawer B-2', 200, 50, CURRENT_DATE - INTERVAL '15 days', 0.099),
        ((SELECT id FROM components WHERE part_number = 'CAP-0805-1UF'), 'Drawer B-2', 300, 50, CURRENT_DATE - INTERVAL '15 days', 0.075),
        ((SELECT id FROM components WHERE part_number = 'IC-LM358-SOIC8'), 'IC Storage Box 1', 50, 20, CURRENT_DATE - INTERVAL '7 days', 0.308),
        ((SELECT id FROM components WHERE part_number = 'IC-LM324-SOIC14'), 'IC Storage Box 1', 30, 15, CURRENT_DATE - INTERVAL '7 days', 0.35);

END $$;

-- Verify the data
SELECT 
    'Components' as table_name, 
    COUNT(*) as record_count 
FROM components
UNION ALL
SELECT 
    'Manufacturers', 
    COUNT(*) 
FROM manufacturers
UNION ALL
SELECT 
    'Distributors', 
    COUNT(*) 
FROM distributors
UNION ALL
SELECT 
    'Inventory', 
    COUNT(*) 
FROM inventory
UNION ALL
SELECT 
    'Component Specifications', 
    COUNT(*) 
FROM component_specifications
UNION ALL
SELECT 
    'Distributor Info', 
    COUNT(*) 
FROM distributor_info;
