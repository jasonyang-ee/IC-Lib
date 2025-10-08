-- Resistors Table with Individual Columns for All Attributes
-- Based on Vishay Dale CRCW06031K00FKEA specifications

CREATE TABLE IF NOT EXISTS resistors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE UNIQUE,
    
    -- Basic Specifications
    resistance VARCHAR(50) NOT NULL,                    -- e.g., "1 kOhms"
    resistance_value DECIMAL(20, 6),                    -- Numeric value in ohms
    tolerance VARCHAR(20),                              -- e.g., "±1%"
    power_rating VARCHAR(50),                           -- e.g., "0.1W, 1/10W"
    power_rating_watts DECIMAL(10, 3),                  -- Numeric value in watts
    
    -- Package Information
    package_case VARCHAR(100),                          -- e.g., "0603 (1608 Metric)"
    mounting_type VARCHAR(50),                          -- e.g., "Surface Mount"
    
    -- Temperature Specifications
    temperature_coefficient VARCHAR(50),                -- e.g., "±100ppm/°C"
    operating_temperature VARCHAR(100),                 -- e.g., "-55°C ~ 155°C"
    
    -- Composition
    composition VARCHAR(50),                            -- e.g., "Thick Film"
    
    -- Features
    features TEXT,                                      -- e.g., "Anti-Sulfur, Automotive AEC-Q200, Moisture Resistant"
    
    -- Physical Dimensions (in mm unless specified)
    height_seated VARCHAR(50),                          -- e.g., "0.022" (0.55mm)"
    
    -- Ratings
    failure_rate VARCHAR(50),                           -- e.g., "-"
    
    -- Series Information
    series VARCHAR(100),                                -- e.g., "CRCW"
    
    -- Additional Technical Specs
    voltage_rating VARCHAR(50),                         -- e.g., "75V"
    number_of_terminals INTEGER,                        -- e.g., 2
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_resistors_component ON resistors(component_id);
CREATE INDEX IF NOT EXISTS idx_resistors_resistance ON resistors(resistance_value);
CREATE INDEX IF NOT EXISTS idx_resistors_package ON resistors(package_case);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_resistors_updated_at BEFORE UPDATE ON resistors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert Vishay Dale CRCW06031K00FKEA Resistor
-- First, we need to insert into manufacturers, components, and then resistors

-- Insert manufacturer if not exists
INSERT INTO manufacturers (name, website) 
VALUES ('Vishay Dale', 'https://www.vishay.com/') 
ON CONFLICT (name) DO NOTHING;

-- Get IDs we need
DO $$
DECLARE
    v_manufacturer_id UUID;
    v_category_id UUID;
    v_component_id UUID;
    v_digikey_id UUID;
BEGIN
    -- Get manufacturer ID
    SELECT id INTO v_manufacturer_id FROM manufacturers WHERE name = 'Vishay Dale';
    
    -- Get category ID for Resistor
    SELECT id INTO v_category_id FROM component_categories WHERE name = 'Resistor';
    
    -- Get Digikey distributor ID
    SELECT id INTO v_digikey_id FROM distributors WHERE name = 'Digikey';
    
    -- Insert component
    INSERT INTO components (
        category_id, 
        part_number, 
        manufacturer_id, 
        manufacturer_part_number,
        description,
        subcategory,
        datasheet_url,
        notes
    ) VALUES (
        v_category_id,
        'RES-CRCW0603-1K0-1%-0.1W',
        v_manufacturer_id,
        'CRCW06031K00FKEA',
        'RES 1K OHM 1% 1/10W 0603',
        'Chip Resistor - Surface Mount',
        'https://www.vishay.com/docs/20035/dcrcwe3.pdf',
        'Thick Film, Anti-Sulfur, Automotive AEC-Q200, Moisture Resistant'
    )
    ON CONFLICT (part_number) DO UPDATE 
    SET manufacturer_part_number = EXCLUDED.manufacturer_part_number
    RETURNING id INTO v_component_id;
    
    -- Insert resistor specifications
    INSERT INTO resistors (
        component_id,
        resistance,
        resistance_value,
        tolerance,
        power_rating,
        power_rating_watts,
        package_case,
        mounting_type,
        temperature_coefficient,
        operating_temperature,
        composition,
        features,
        height_seated,
        series,
        voltage_rating,
        number_of_terminals
    ) VALUES (
        v_component_id,
        '1 kOhms',
        1000,
        '±1%',
        '0.1W, 1/10W',
        0.1,
        '0603 (1608 Metric)',
        'Surface Mount',
        '±100ppm/°C',
        '-55°C ~ 155°C',
        'Thick Film',
        'Anti-Sulfur, Automotive AEC-Q200, Moisture Resistant',
        '0.022" (0.55mm)',
        'CRCW',
        '75V',
        2
    )
    ON CONFLICT (component_id) DO UPDATE
    SET 
        resistance = EXCLUDED.resistance,
        resistance_value = EXCLUDED.resistance_value,
        tolerance = EXCLUDED.tolerance,
        power_rating = EXCLUDED.power_rating,
        power_rating_watts = EXCLUDED.power_rating_watts,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Insert distributor info for Digikey
    INSERT INTO distributor_info (
        component_id,
        distributor_id,
        distributor_part_number,
        stock_quantity,
        price_breaks,
        product_url,
        last_updated
    ) VALUES (
        v_component_id,
        v_digikey_id,
        'CRCW06031K00FKEACT-ND',
        50000,  -- Example stock quantity
        '[
            {"quantity": 1, "price": 0.10},
            {"quantity": 10, "price": 0.031},
            {"quantity": 100, "price": 0.017},
            {"quantity": 500, "price": 0.012},
            {"quantity": 1000, "price": 0.01}
        ]'::jsonb,
        'https://www.digikey.com/en/products/detail/vishay-dale/CRCW06031K00FKEA/1174668',
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (component_id, distributor_id) DO UPDATE
    SET 
        stock_quantity = EXCLUDED.stock_quantity,
        price_breaks = EXCLUDED.price_breaks,
        last_updated = CURRENT_TIMESTAMP;
    
    -- Add sample inventory
    INSERT INTO inventory (
        component_id,
        location,
        quantity,
        minimum_quantity,
        purchase_date,
        purchase_price,
        notes
    ) VALUES (
        v_component_id,
        'Resistor-Drawer-A1',
        250,
        50,
        CURRENT_DATE,
        0.01,
        'Standard 1K resistor for general use'
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Successfully inserted Vishay Dale CRCW06031K00FKEA resistor';
END $$;
