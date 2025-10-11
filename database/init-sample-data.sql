-- ============================================================================
-- AllegroSQL Sample Data - Minimal Test Set
-- ============================================================================

-- Manufacturers
INSERT INTO manufacturers (name, website) VALUES
    ('Yageo', 'https://www.yageo.com'),
    ('Kemet', 'https://www.kemet.com'),
    ('Murata Electronics', 'https://www.murata.com'),
    ('Diodes Incorporated', 'https://www.diodes.com'),
    ('Texas Instruments', 'https://www.ti.com'),
    ('STMicroelectronics', 'https://www.st.com')
ON CONFLICT (name) DO NOTHING;

-- Resistor: Yageo RC0603FR-072K2L
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url, status) 
VALUES (
    2,
    'RES-0001',
    (SELECT id FROM manufacturers WHERE name = 'Yageo'),
    'RC0603FR-072K2L',
    'RES SMD 2.2K OHM 1% 1/10W 0603',
    '2.2kΩ',
    'R_0603',
    '0603',
    'Chip Resistor',
    'Thick Film',
    'https://www.yageo.com/upload/media/product/productsearch/datasheet/rchip/PYu-RC_Group_51_RoHS_L_12.pdf',
    'Active'
)
ON CONFLICT (part_number) DO NOTHING;

-- Add specifications for Resistor using new schema
-- First ensure category specifications exist for Resistors (category_id = 2)
INSERT INTO category_specifications (category_id, spec_name, unit, display_order, is_required) VALUES
    (2, 'Resistance', 'Ω', 1, true),
    (2, 'Tolerance', '%', 2, true),
    (2, 'Power Rating', 'W', 3, true)
ON CONFLICT (category_id, spec_name) DO NOTHING;

-- Now insert component specification values
INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 2 AND spec_name = 'Resistance'), 
     '2200'),
    ((SELECT id FROM components WHERE part_number = 'RES-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 2 AND spec_name = 'Tolerance'), 
     '1'),
    ((SELECT id FROM components WHERE part_number = 'RES-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 2 AND spec_name = 'Power Rating'), 
     '0.1')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-0001'), (SELECT id FROM distributors WHERE name = 'Digikey'), '311-2.20KHRCT-ND', 'https://www.digikey.com/en/products/detail/yageo/RC0603FR-072K2L/727016', 0.10, 'USD', true, 50000)
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

-- Capacitor: Kemet C0603C104K5RACTU
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url, status) 
VALUES (
    1,
    'CAP-0001',
    (SELECT id FROM manufacturers WHERE name = 'Kemet'),
    'C0603C104K5RACTU',
    'CAP CER 0.1UF 50V X7R 0603',
    '0.1uF',
    'C_0603',
    '0603',
    'Ceramic',
    'X7R',
    'https://content.kemet.com/datasheets/KEM_C1002_X7R_SMD.pdf',
    'Active'
)
ON CONFLICT (part_number) DO NOTHING;

-- Add specifications for Capacitor using new schema
-- First ensure category specifications exist for Capacitors (category_id = 1)
INSERT INTO category_specifications (category_id, spec_name, unit, display_order, is_required) VALUES
    (1, 'Capacitance', 'uF', 1, true),
    (1, 'Voltage Rating', 'V', 2, true),
    (1, 'Tolerance', '%', 3, false)
ON CONFLICT (category_id, spec_name) DO NOTHING;

-- Now insert component specification values
INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 1 AND spec_name = 'Capacitance'), 
     '0.1'),
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 1 AND spec_name = 'Voltage Rating'), 
     '50'),
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 1 AND spec_name = 'Tolerance'), 
     '±10')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), (SELECT id FROM distributors WHERE name = 'Digikey'), '399-1096-1-ND', 'https://www.digikey.com/en/products/detail/kemet/C0603C104K5RACTU/1465594', 0.12, 'USD', true, 250000)
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;
