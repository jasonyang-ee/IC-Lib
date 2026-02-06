-- ============================================================================
-- AllegroSQL Sample Data - Comprehensive Test Set
-- ============================================================================
-- Updated for UUID v7 schema (v3.0.0)
-- Uses category name subqueries instead of integer IDs
-- Uses price_breaks JSONB instead of price column
-- ============================================================================

-- ============================================================================
-- MANUFACTURERS
-- ============================================================================
INSERT INTO manufacturers (name, website) VALUES
    ('Yageo', 'https://www.yageo.com'),
    ('Kemet', 'https://www.kemet.com'),
    ('Murata Electronics', 'https://www.murata.com'),
    ('Diodes Incorporated', 'https://www.diodes.com'),
    ('Texas Instruments', 'https://www.ti.com'),
    ('STMicroelectronics', 'https://www.st.com'),
    ('Vishay', 'https://www.vishay.com'),
    ('Samsung Electro-Mechanics', 'https://www.samsungsem.com'),
    ('Bourns', 'https://www.bourns.com'),
    ('Infineon Technologies', 'https://www.infineon.com'),
    ('ON Semiconductor', 'https://www.onsemi.com'),
    ('Microchip Technology', 'https://www.microchip.com'),
    ('NXP Semiconductors', 'https://www.nxp.com'),
    ('Analog Devices', 'https://www.analog.com'),
    ('Würth Elektronik', 'https://www.we-online.com')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- RESISTORS
-- ============================================================================

-- Resistor 1: Yageo RC0603FR-072K2L - 2.2kΩ 0603
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url)
VALUES (
    (SELECT id FROM component_categories WHERE name = 'Resistors'), 'RES-00001',
    (SELECT id FROM manufacturers WHERE name = 'Yageo'),
    'RC0603FR-072K2L',
    'RES SMD 2.2K OHM 1% 1/10W 0603',
    '2.2kΩ',
    'R_0603',
    '0603',
    'Chip Resistor',
    'Thick Film',
    'https://www.yageo.com/upload/media/product/productsearch/datasheet/rchip/PYu-RC_Group_51_RoHS_L_12.pdf'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Resistors') AND spec_name = 'Resistance'), '2200'),
    ((SELECT id FROM components WHERE part_number = 'RES-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Resistors') AND spec_name = 'Tolerance'), '1'),
    ((SELECT id FROM components WHERE part_number = 'RES-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Resistors') AND spec_name = 'Power'), '0.1')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, in_stock, stock_quantity, price_breaks) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-00001'), (SELECT id FROM distributors WHERE name = 'Digikey'), '311-2.20KHRCT-ND', 'https://www.digikey.com/product-detail/en/RC0603FR-072K2L/311-2.20KHRCT-ND', true, 50000, '[{"quantity": 1, "price": 0.10}, {"quantity": 100, "price": 0.04}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'RES-00001'), (SELECT id FROM distributors WHERE name = 'Mouser'), '603-RC0603FR-072K2L', 'https://www.mouser.com/ProductDetail/603-RC0603FR-072K2L', true, 35000, '[{"quantity": 1, "price": 0.12}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'RES-00001'), (SELECT id FROM distributors WHERE name = 'Arrow'), 'RC0603FR-072K2L', 'https://www.arrow.com/en/products/rc0603fr-072k2l', true, 20000, '[{"quantity": 1, "price": 0.11}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'RES-00001'), (SELECT id FROM distributors WHERE name = 'Newark'), '24C1254', 'https://www.newark.com/yageo/rc0603fr-072k2l', true, 15000, '[{"quantity": 1, "price": 0.13}]'::jsonb)
ON CONFLICT (component_id, distributor_id) DO NOTHING;

-- Resistor 2: Vishay CRCW080510K0FKEA - 10kΩ 0805
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url)
VALUES (
    (SELECT id FROM component_categories WHERE name = 'Resistors'), 'RES-00002',
    (SELECT id FROM manufacturers WHERE name = 'Vishay'),
    'CRCW080510K0FKEA',
    'RES SMD 10K OHM 1% 1/8W 0805',
    '10kΩ',
    'R_0805',
    '0805',
    'Chip Resistor',
    'Thick Film',
    'https://www.vishay.com/docs/20035/dcrcwe3.pdf'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-00002'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Resistors') AND spec_name = 'Resistance'), '10000'),
    ((SELECT id FROM components WHERE part_number = 'RES-00002'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Resistors') AND spec_name = 'Tolerance'), '1'),
    ((SELECT id FROM components WHERE part_number = 'RES-00002'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Resistors') AND spec_name = 'Power'), '0.125')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, in_stock, stock_quantity, price_breaks) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-00002'), (SELECT id FROM distributors WHERE name = 'Digikey'), '541-10.0KCCT-ND', 'https://www.digikey.com/product-detail/en/CRCW080510K0FKEA', true, 100000, '[{"quantity": 1, "price": 0.10}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'RES-00002'), (SELECT id FROM distributors WHERE name = 'Mouser'), '71-CRCW0805-10K-E3', 'https://www.mouser.com/ProductDetail/71-CRCW0805-10K-E3', true, 80000, '[{"quantity": 1, "price": 0.11}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'RES-00002'), (SELECT id FROM distributors WHERE name = 'Arrow'), 'CRCW080510K0FKEA', 'https://www.arrow.com/en/products/crcw080510k0fkea', true, 45000, '[{"quantity": 1, "price": 0.09}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'RES-00002'), (SELECT id FROM distributors WHERE name = 'Newark'), '58K8923', 'https://www.newark.com/vishay/crcw080510k0fkea', true, 30000, '[{"quantity": 1, "price": 0.12}]'::jsonb)
ON CONFLICT (component_id, distributor_id) DO NOTHING;

-- Resistor 3: Yageo RC0603FR-071KL - 1kΩ 0603
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url)
VALUES (
    (SELECT id FROM component_categories WHERE name = 'Resistors'), 'RES-00003',
    (SELECT id FROM manufacturers WHERE name = 'Yageo'),
    'RC0603FR-071KL',
    'RES SMD 1K OHM 1% 1/10W 0603',
    '1kΩ',
    'R_0603',
    '0603',
    'Chip Resistor',
    'Thick Film',
    'https://www.yageo.com/upload/media/product/productsearch/datasheet/rchip/PYu-RC_Group_51_RoHS_L_12.pdf'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-00003'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Resistors') AND spec_name = 'Resistance'), '1000'),
    ((SELECT id FROM components WHERE part_number = 'RES-00003'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Resistors') AND spec_name = 'Tolerance'), '1'),
    ((SELECT id FROM components WHERE part_number = 'RES-00003'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Resistors') AND spec_name = 'Power'), '0.1')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, in_stock, stock_quantity, price_breaks) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-00003'), (SELECT id FROM distributors WHERE name = 'Digikey'), '311-1.00KHRCT-ND', 'https://www.digikey.com/product-detail/en/RC0603FR-071KL', true, 75000, '[{"quantity": 1, "price": 0.10}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'RES-00003'), (SELECT id FROM distributors WHERE name = 'Mouser'), '603-RC0603FR-071KL', 'https://www.mouser.com/ProductDetail/603-RC0603FR-071KL', true, 60000, '[{"quantity": 1, "price": 0.11}]'::jsonb)
ON CONFLICT (component_id, distributor_id) DO NOTHING;

-- ============================================================================
-- CAPACITORS
-- ============================================================================

-- Capacitor 1: Kemet C0603C104K5RACTU - 0.1uF 50V 0603
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url)
VALUES (
    (SELECT id FROM component_categories WHERE name = 'Capacitors'), 'CAP-00001',
    (SELECT id FROM manufacturers WHERE name = 'Kemet'),
    'C0603C104K5RACTU',
    'CAP CER 0.1UF 50V X7R 0603',
    '0.1uF',
    'C_0603',
    '0603',
    'Ceramic',
    'X7R',
    'https://content.kemet.com/datasheets/KEM_C1002_X7R_SMD.pdf'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Capacitors') AND spec_name = 'Capacitance'), '0.1'),
    ((SELECT id FROM components WHERE part_number = 'CAP-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Capacitors') AND spec_name = 'Voltage Rating'), '50'),
    ((SELECT id FROM components WHERE part_number = 'CAP-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Capacitors') AND spec_name = 'Tolerance'), '10')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, in_stock, stock_quantity, price_breaks) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-00001'), (SELECT id FROM distributors WHERE name = 'Digikey'), '399-1096-1-ND', 'https://www.digikey.com/product-detail/en/C0603C104K5RACTU', true, 250000, '[{"quantity": 1, "price": 0.12}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'CAP-00001'), (SELECT id FROM distributors WHERE name = 'Mouser'), '80-C0603C104K5R', 'https://www.mouser.com/ProductDetail/80-C0603C104K5R', true, 180000, '[{"quantity": 1, "price": 0.14}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'CAP-00001'), (SELECT id FROM distributors WHERE name = 'Arrow'), 'C0603C104K5RACTU', 'https://www.arrow.com/en/products/c0603c104k5ractu', true, 120000, '[{"quantity": 1, "price": 0.13}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'CAP-00001'), (SELECT id FROM distributors WHERE name = 'Newark'), '25C3880', 'https://www.newark.com/kemet/c0603c104k5ractu', true, 90000, '[{"quantity": 1, "price": 0.15}]'::jsonb)
ON CONFLICT (component_id, distributor_id) DO NOTHING;

-- Capacitor 2: Murata GRM188R71C225KA12D - 2.2uF 16V 0603
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url)
VALUES (
    (SELECT id FROM component_categories WHERE name = 'Capacitors'), 'CAP-00002',
    (SELECT id FROM manufacturers WHERE name = 'Murata Electronics'),
    'GRM188R71C225KA12D',
    'CAP CER 2.2UF 16V X7R 0603',
    '2.2uF',
    'C_0603',
    '0603',
    'Ceramic',
    'X7R',
    'https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM188R71C225KA12-01.pdf'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-00002'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Capacitors') AND spec_name = 'Capacitance'), '2.2'),
    ((SELECT id FROM components WHERE part_number = 'CAP-00002'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Capacitors') AND spec_name = 'Voltage Rating'), '16'),
    ((SELECT id FROM components WHERE part_number = 'CAP-00002'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Capacitors') AND spec_name = 'Tolerance'), '10')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, in_stock, stock_quantity, price_breaks) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-00002'), (SELECT id FROM distributors WHERE name = 'Digikey'), '490-3889-1-ND', 'https://www.digikey.com/product-detail/en/GRM188R71C225KA12D', true, 140000, '[{"quantity": 1, "price": 0.18}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'CAP-00002'), (SELECT id FROM distributors WHERE name = 'Mouser'), '81-GRM188R71C225KA2D', 'https://www.mouser.com/ProductDetail/81-GRM188R71C225KA2D', true, 120000, '[{"quantity": 1, "price": 0.20}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'CAP-00002'), (SELECT id FROM distributors WHERE name = 'Arrow'), 'GRM188R71C225KA12D', 'https://www.arrow.com/en/products/grm188r71c225ka12d', true, 80000, '[{"quantity": 1, "price": 0.19}]'::jsonb)
ON CONFLICT (component_id, distributor_id) DO NOTHING;

-- Capacitor 3: Samsung CL10A106KP8NNNC - 10uF 10V 0603
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url)
VALUES (
    (SELECT id FROM component_categories WHERE name = 'Capacitors'), 'CAP-00003',
    (SELECT id FROM manufacturers WHERE name = 'Samsung Electro-Mechanics'),
    'CL10A106KP8NNNC',
    'CAP CER 10UF 10V X5R 0603',
    '10uF',
    'C_0603',
    '0603',
    'Ceramic',
    'X5R',
    'https://product.samsungsem.com/mlcc/CL10A106KP8NNNC.do'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-00003'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Capacitors') AND spec_name = 'Capacitance'), '10'),
    ((SELECT id FROM components WHERE part_number = 'CAP-00003'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Capacitors') AND spec_name = 'Voltage Rating'), '10'),
    ((SELECT id FROM components WHERE part_number = 'CAP-00003'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Capacitors') AND spec_name = 'Tolerance'), '10')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, in_stock, stock_quantity, price_breaks) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-00003'), (SELECT id FROM distributors WHERE name = 'Digikey'), '1276-1946-1-ND', 'https://www.digikey.com/product-detail/en/CL10A106KP8NNNC', true, 95000, '[{"quantity": 1, "price": 0.22}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'CAP-00003'), (SELECT id FROM distributors WHERE name = 'Mouser'), '187-CL10A106KP8NNNC', 'https://www.mouser.com/ProductDetail/187-CL10A106KP8NNNC', true, 70000, '[{"quantity": 1, "price": 0.24}]'::jsonb)
ON CONFLICT (component_id, distributor_id) DO NOTHING;

-- ============================================================================
-- INDUCTORS
-- ============================================================================

-- Inductor 1: Würth 744771110 - 10uH 1210
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url)
VALUES (
    (SELECT id FROM component_categories WHERE name = 'Inductors'), 'IND-00001',
    (SELECT id FROM manufacturers WHERE name = 'Würth Elektronik'),
    '744771110',
    'IND SMD 10UH 1.95A 1210',
    '10uH',
    'L_1210',
    '1210',
    'Power Inductor',
    'Shielded',
    'https://www.we-online.com/catalog/datasheet/744771110.pdf'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'IND-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Inductors') AND spec_name = 'Inductance'), '10e-6'),
    ((SELECT id FROM components WHERE part_number = 'IND-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Inductors') AND spec_name = 'Current Rating'), '1.95'),
    ((SELECT id FROM components WHERE part_number = 'IND-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Inductors') AND spec_name = 'Tolerance'), '20'),
    ((SELECT id FROM components WHERE part_number = 'IND-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Inductors') AND spec_name = 'DC Resistance'), '0.086')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, in_stock, stock_quantity, price_breaks) VALUES
    ((SELECT id FROM components WHERE part_number = 'IND-00001'), (SELECT id FROM distributors WHERE name = 'Digikey'), '732-2277-1-ND', 'https://www.digikey.com/product-detail/en/744771110', true, 35000, '[{"quantity": 1, "price": 0.58}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'IND-00001'), (SELECT id FROM distributors WHERE name = 'Mouser'), '710-744771110', 'https://www.mouser.com/ProductDetail/710-744771110', true, 28000, '[{"quantity": 1, "price": 0.62}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'IND-00001'), (SELECT id FROM distributors WHERE name = 'Arrow'), '744771110', 'https://www.arrow.com/en/products/744771110', true, 15000, '[{"quantity": 1, "price": 0.60}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'IND-00001'), (SELECT id FROM distributors WHERE name = 'Newark'), '47AC6754', 'https://www.newark.com/wurth-elektronik/744771110', true, 12000, '[{"quantity": 1, "price": 0.65}]'::jsonb)
ON CONFLICT (component_id, distributor_id) DO NOTHING;

-- ============================================================================
-- DIODES
-- ============================================================================

-- Diode 1: Diodes Inc 1N4148W-7-F - SOD-123
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url)
VALUES (
    (SELECT id FROM component_categories WHERE name = 'Diodes'), 'DIODE-00001',
    (SELECT id FROM manufacturers WHERE name = 'Diodes Incorporated'),
    '1N4148W-7-F',
    'DIODE GEN PURP 100V 300MA SOD123',
    '100V',
    'D_SOD-123',
    'SOD-123',
    'Switching',
    'General Purpose',
    'https://www.diodes.com/assets/Datasheets/ds30086.pdf'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'DIODE-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Diodes') AND spec_name = 'Forward Voltage'), '1.0'),
    ((SELECT id FROM components WHERE part_number = 'DIODE-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Diodes') AND spec_name = 'Current Rectified'), '0.3'),
    ((SELECT id FROM components WHERE part_number = 'DIODE-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Diodes') AND spec_name = 'Reverse Voltage'), '100')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, in_stock, stock_quantity, price_breaks) VALUES
    ((SELECT id FROM components WHERE part_number = 'DIODE-00001'), (SELECT id FROM distributors WHERE name = 'Digikey'), '1N4148W-FDICT-ND', 'https://www.digikey.com/product-detail/en/1N4148W-7-F', true, 180000, '[{"quantity": 1, "price": 0.12}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'DIODE-00001'), (SELECT id FROM distributors WHERE name = 'Mouser'), '621-1N4148W-F', 'https://www.mouser.com/ProductDetail/621-1N4148W-F', true, 150000, '[{"quantity": 1, "price": 0.13}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'DIODE-00001'), (SELECT id FROM distributors WHERE name = 'Arrow'), '1N4148W-7-F', 'https://www.arrow.com/en/products/1n4148w-7-f', true, 95000, '[{"quantity": 1, "price": 0.11}]'::jsonb)
ON CONFLICT (component_id, distributor_id) DO NOTHING;

-- ============================================================================
-- TRANSISTORS / MOSFETs
-- ============================================================================

-- MOSFET 1: Infineon IRLML6402TRPBF - P-Channel SOT-23
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url)
VALUES (
    (SELECT id FROM component_categories WHERE name = 'Transistors'), 'FET-00001',
    (SELECT id FROM manufacturers WHERE name = 'Infineon Technologies'),
    'IRLML6402TRPBF',
    'MOSFET P-CH 20V 3.7A SOT-23',
    '-20V',
    'SOT-23',
    'SOT-23',
    'MOSFET',
    'P-Channel',
    'https://www.infineon.com/dgdl/irlml6402pbf.pdf'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'FET-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Transistors') AND spec_name = 'Transistor Type'), 'P-Channel MOSFET'),
    ((SELECT id FROM components WHERE part_number = 'FET-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Transistors') AND spec_name = 'Vdss'), '-20'),
    ((SELECT id FROM components WHERE part_number = 'FET-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Transistors') AND spec_name = 'Id'), '-3.7'),
    ((SELECT id FROM components WHERE part_number = 'FET-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'Transistors') AND spec_name = 'Rds On'), '0.065')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, in_stock, stock_quantity, price_breaks) VALUES
    ((SELECT id FROM components WHERE part_number = 'FET-00001'), (SELECT id FROM distributors WHERE name = 'Digikey'), 'IRLML6402TRPBFCT-ND', 'https://www.digikey.com/product-detail/en/IRLML6402TRPBF', true, 85000, '[{"quantity": 1, "price": 0.48}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'FET-00001'), (SELECT id FROM distributors WHERE name = 'Mouser'), '942-IRLML6402TRPBF', 'https://www.mouser.com/ProductDetail/942-IRLML6402TRPBF', true, 65000, '[{"quantity": 1, "price": 0.52}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'FET-00001'), (SELECT id FROM distributors WHERE name = 'Arrow'), 'IRLML6402TRPBF', 'https://www.arrow.com/en/products/irlml6402trpbf', true, 45000, '[{"quantity": 1, "price": 0.50}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'FET-00001'), (SELECT id FROM distributors WHERE name = 'Newark'), '19M4584', 'https://www.newark.com/infineon/irlml6402trpbf', true, 30000, '[{"quantity": 1, "price": 0.55}]'::jsonb)
ON CONFLICT (component_id, distributor_id) DO NOTHING;

-- ============================================================================
-- INTEGRATED CIRCUITS
-- ============================================================================

-- IC 1: Texas Instruments LM358DR - Dual Op-Amp SOIC-8
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url)
VALUES (
    (SELECT id FROM component_categories WHERE name = 'ICs'), 'IC-00001',
    (SELECT id FROM manufacturers WHERE name = 'Texas Instruments'),
    'LM358DR',
    'IC OPAMP DUAL GP 8-SOIC',
    'Dual Op-Amp',
    'SOIC-8',
    'SOIC-8',
    'Op-Amp',
    'General Purpose',
    'https://www.ti.com/lit/ds/symlink/lm358.pdf'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'IC-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'ICs') AND spec_name = 'Supply Voltage'), '3-32'),
    ((SELECT id FROM components WHERE part_number = 'IC-00001'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'ICs') AND spec_name = 'Number of Channels'), '2')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, in_stock, stock_quantity, price_breaks) VALUES
    ((SELECT id FROM components WHERE part_number = 'IC-00001'), (SELECT id FROM distributors WHERE name = 'Digikey'), '296-9640-1-ND', 'https://www.digikey.com/product-detail/en/LM358DR', true, 120000, '[{"quantity": 1, "price": 0.45}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'IC-00001'), (SELECT id FROM distributors WHERE name = 'Mouser'), '595-LM358DR', 'https://www.mouser.com/ProductDetail/595-LM358DR', true, 95000, '[{"quantity": 1, "price": 0.48}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'IC-00001'), (SELECT id FROM distributors WHERE name = 'Arrow'), 'LM358DR', 'https://www.arrow.com/en/products/lm358dr', true, 75000, '[{"quantity": 1, "price": 0.46}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'IC-00001'), (SELECT id FROM distributors WHERE name = 'Newark'), '25C2839', 'https://www.newark.com/texas-instruments/lm358dr', true, 60000, '[{"quantity": 1, "price": 0.50}]'::jsonb)
ON CONFLICT (component_id, distributor_id) DO NOTHING;

-- IC 2: STMicroelectronics STM32F103C8T6 - MCU LQFP-48
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, sub_category3, datasheet_url)
VALUES (
    (SELECT id FROM component_categories WHERE name = 'MCU'), 'IC-00002',
    (SELECT id FROM manufacturers WHERE name = 'STMicroelectronics'),
    'STM32F103C8T6',
    'IC MCU 32BIT 64KB FLASH LQFP-48',
    'ARM Cortex-M3',
    'LQFP-48',
    'LQFP-48',
    'Microcontroller',
    'ARM Cortex-M3',
    '32-bit',
    'https://www.st.com/resource/en/datasheet/stm32f103c8.pdf'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'IC-00002'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'MCU') AND spec_name = 'Supply Voltage'), '2.0-3.6'),
    ((SELECT id FROM components WHERE part_number = 'IC-00002'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'MCU') AND spec_name = 'Clock Speed'), '72000000'),
    ((SELECT id FROM components WHERE part_number = 'IC-00002'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'MCU') AND spec_name = 'Flash Memory'), '64'),
    ((SELECT id FROM components WHERE part_number = 'IC-00002'),
     (SELECT id FROM category_specifications WHERE category_id = (SELECT id FROM component_categories WHERE name = 'MCU') AND spec_name = 'RAM'), '20')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, in_stock, stock_quantity, price_breaks) VALUES
    ((SELECT id FROM components WHERE part_number = 'IC-00002'), (SELECT id FROM distributors WHERE name = 'Digikey'), '497-6063-ND', 'https://www.digikey.com/product-detail/en/STM32F103C8T6', true, 25000, '[{"quantity": 1, "price": 4.52}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'IC-00002'), (SELECT id FROM distributors WHERE name = 'Mouser'), '511-STM32F103C8T6', 'https://www.mouser.com/ProductDetail/511-STM32F103C8T6', true, 18000, '[{"quantity": 1, "price": 4.68}]'::jsonb),
    ((SELECT id FROM components WHERE part_number = 'IC-00002'), (SELECT id FROM distributors WHERE name = 'Arrow'), 'STM32F103C8T6', 'https://www.arrow.com/en/products/stm32f103c8t6', true, 12000, '[{"quantity": 1, "price": 4.55}]'::jsonb)
ON CONFLICT (component_id, distributor_id) DO NOTHING;

-- ============================================================================
-- ALTERNATIVE PARTS
-- ============================================================================

-- Alternative for RES-00001: Vishay equivalent
INSERT INTO components_alternative (component_id, manufacturer_id, manufacturer_pn) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-00001'), (SELECT id FROM manufacturers WHERE name = 'Vishay'), 'CRCW06032K20FKEA')
ON CONFLICT (component_id, manufacturer_id, manufacturer_pn) DO NOTHING;

INSERT INTO distributor_info (alternative_id, distributor_id, sku, url, in_stock, stock_quantity, price_breaks) VALUES
    ((SELECT id FROM components_alternative WHERE component_id = (SELECT id FROM components WHERE part_number = 'RES-00001') AND manufacturer_pn = 'CRCW06032K20FKEA'),
     (SELECT id FROM distributors WHERE name = 'Digikey'), '541-2.20KCCT-ND', 'https://www.digikey.com/product-detail/en/CRCW06032K20FKEA', true, 45000, '[{"quantity": 1, "price": 0.10}]'::jsonb),
    ((SELECT id FROM components_alternative WHERE component_id = (SELECT id FROM components WHERE part_number = 'RES-00001') AND manufacturer_pn = 'CRCW06032K20FKEA'),
     (SELECT id FROM distributors WHERE name = 'Mouser'), '71-CRCW0603-2.2K-E3', 'https://www.mouser.com/ProductDetail/71-CRCW0603-2.2K-E3', true, 38000, '[{"quantity": 1, "price": 0.11}]'::jsonb)
ON CONFLICT (alternative_id, distributor_id) DO NOTHING;

-- Alternative for CAP-00001: Samsung equivalent
INSERT INTO components_alternative (component_id, manufacturer_id, manufacturer_pn) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-00001'), (SELECT id FROM manufacturers WHERE name = 'Samsung Electro-Mechanics'), 'CL10B104KB8NNNC')
ON CONFLICT (component_id, manufacturer_id, manufacturer_pn) DO NOTHING;

INSERT INTO distributor_info (alternative_id, distributor_id, sku, url, in_stock, stock_quantity, price_breaks) VALUES
    ((SELECT id FROM components_alternative WHERE component_id = (SELECT id FROM components WHERE part_number = 'CAP-00001') AND manufacturer_pn = 'CL10B104KB8NNNC'),
     (SELECT id FROM distributors WHERE name = 'Digikey'), '1276-1003-1-ND', 'https://www.digikey.com/product-detail/en/CL10B104KB8NNNC', true, 220000, '[{"quantity": 1, "price": 0.11}]'::jsonb),
    ((SELECT id FROM components_alternative WHERE component_id = (SELECT id FROM components WHERE part_number = 'CAP-00001') AND manufacturer_pn = 'CL10B104KB8NNNC'),
     (SELECT id FROM distributors WHERE name = 'Mouser'), '187-CL10B104KB8NNNC', 'https://www.mouser.com/ProductDetail/187-CL10B104KB8NNNC', true, 175000, '[{"quantity": 1, "price": 0.13}]'::jsonb),
    ((SELECT id FROM components_alternative WHERE component_id = (SELECT id FROM components WHERE part_number = 'CAP-00001') AND manufacturer_pn = 'CL10B104KB8NNNC'),
     (SELECT id FROM distributors WHERE name = 'Arrow'), 'CL10B104KB8NNNC', 'https://www.arrow.com/en/products/cl10b104kb8nnnc', true, 110000, '[{"quantity": 1, "price": 0.12}]'::jsonb)
ON CONFLICT (alternative_id, distributor_id) DO NOTHING;

-- ============================================================================
-- INVENTORY DATA
-- ============================================================================

INSERT INTO inventory (component_id, quantity, minimum_quantity, location)
SELECT
    c.id,
    CASE
        WHEN c.part_number = 'RES-00001' THEN 500
        WHEN c.part_number = 'RES-00002' THEN 300
        WHEN c.part_number = 'RES-00003' THEN 250
        WHEN c.part_number = 'CAP-00001' THEN 400
        WHEN c.part_number = 'CAP-00002' THEN 200
        WHEN c.part_number = 'CAP-00003' THEN 150
        WHEN c.part_number = 'IND-00001' THEN 100
        WHEN c.part_number = 'DIODE-00001' THEN 350
        WHEN c.part_number = 'FET-00001' THEN 120
        WHEN c.part_number = 'IC-00001' THEN 80
        WHEN c.part_number = 'IC-00002' THEN 25
        ELSE 0
    END as quantity,
    CASE
        WHEN c.part_number LIKE 'RES-%' OR c.part_number LIKE 'CAP-%' THEN 50
        WHEN c.part_number LIKE 'DIODE-%' THEN 25
        WHEN c.part_number LIKE 'IC-%' OR c.part_number LIKE 'FET-%' THEN 10
        ELSE 5
    END as minimum_quantity,
    CASE
        WHEN c.part_number LIKE 'RES-%' OR c.part_number LIKE 'CAP-%' THEN 'Storage-A1'
        WHEN c.part_number LIKE 'IND-%' THEN 'Storage-A2'
        WHEN c.part_number LIKE 'DIODE-%' THEN 'Storage-B1'
        WHEN c.part_number LIKE 'FET-%' THEN 'Storage-B2'
        WHEN c.part_number LIKE 'IC-%' THEN 'Storage-C1'
        ELSE 'Storage-General'
    END as location
FROM components c
WHERE c.part_number IN ('RES-00001', 'RES-00002', 'RES-00003', 'CAP-00001', 'CAP-00002', 'CAP-00003',
                        'IND-00001', 'DIODE-00001', 'FET-00001', 'IC-00001', 'IC-00002')
ON CONFLICT (component_id) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    minimum_quantity = EXCLUDED.minimum_quantity,
    location = EXCLUDED.location;
