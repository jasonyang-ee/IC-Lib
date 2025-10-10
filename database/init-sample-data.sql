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

INSERT INTO component_specifications (component_id, spec_name, spec_value, unit) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-0001'), 'Resistance', '2200', 'Ω'),
    ((SELECT id FROM components WHERE part_number = 'RES-0001'), 'Tolerance', '1', '%'),
    ((SELECT id FROM components WHERE part_number = 'RES-0001'), 'Power Rating', '0.1', 'W')
ON CONFLICT DO NOTHING;

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

INSERT INTO component_specifications (component_id, spec_name, spec_value, unit) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), 'Capacitance', '0.1', 'uF'),
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), 'Voltage Rating', '50', 'V'),
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), 'Tolerance', '±10', '%')
ON CONFLICT DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), (SELECT id FROM distributors WHERE name = 'Digikey'), '399-1096-1-ND', 'https://www.digikey.com/en/products/detail/kemet/C0603C104K5RACTU/1465594', 0.12, 'USD', true, 250000)
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;
