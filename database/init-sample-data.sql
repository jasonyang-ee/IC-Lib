-- ============================================================================
-- AllegroSQL Sample Data - Comprehensive Test Set
-- ============================================================================
-- Updated to include more parts across different categories
-- Distributor order: Digikey, Mouser, Arrow, Newark
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
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url, status) 
VALUES (
    2, 'RES-0001',
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

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 2 AND spec_name = 'Resistance'), '2200'),
    ((SELECT id FROM components WHERE part_number = 'RES-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 2 AND spec_name = 'Tolerance'), '1'),
    ((SELECT id FROM components WHERE part_number = 'RES-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 2 AND spec_name = 'Power Rating'), '0.1')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-0001'), (SELECT id FROM distributors WHERE name = 'Digikey'), '311-2.20KHRCT-ND', 'https://www.digikey.com/product-detail/en/RC0603FR-072K2L/311-2.20KHRCT-ND', 0.10, true, 50000),
    ((SELECT id FROM components WHERE part_number = 'RES-0001'), (SELECT id FROM distributors WHERE name = 'Mouser'), '603-RC0603FR-072K2L', 'https://www.mouser.com/ProductDetail/603-RC0603FR-072K2L', 0.12, true, 35000),
    ((SELECT id FROM components WHERE part_number = 'RES-0001'), (SELECT id FROM distributors WHERE name = 'Arrow'), 'RC0603FR-072K2L', 'https://www.arrow.com/en/products/rc0603fr-072k2l', 0.11, true, 20000),
    ((SELECT id FROM components WHERE part_number = 'RES-0001'), (SELECT id FROM distributors WHERE name = 'Newark'), '24C1254', 'https://www.newark.com/yageo/rc0603fr-072k2l', 0.13, true, 15000)
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

-- Resistor 2: Vishay CRCW080510K0FKEA - 10kΩ 0805
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url, status) 
VALUES (
    2, 'RES-0002',
    (SELECT id FROM manufacturers WHERE name = 'Vishay'),
    'CRCW080510K0FKEA',
    'RES SMD 10K OHM 1% 1/8W 0805',
    '10kΩ',
    'R_0805',
    '0805',
    'Chip Resistor',
    'Thick Film',
    'https://www.vishay.com/docs/20035/dcrcwe3.pdf',
    'Active'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-0002'), 
     (SELECT id FROM category_specifications WHERE category_id = 2 AND spec_name = 'Resistance'), '10000'),
    ((SELECT id FROM components WHERE part_number = 'RES-0002'), 
     (SELECT id FROM category_specifications WHERE category_id = 2 AND spec_name = 'Tolerance'), '1'),
    ((SELECT id FROM components WHERE part_number = 'RES-0002'), 
     (SELECT id FROM category_specifications WHERE category_id = 2 AND spec_name = 'Power Rating'), '0.125')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-0002'), (SELECT id FROM distributors WHERE name = 'Digikey'), '541-10.0KCCT-ND', 'https://www.digikey.com/product-detail/en/CRCW080510K0FKEA', 0.10, true, 100000),
    ((SELECT id FROM components WHERE part_number = 'RES-0002'), (SELECT id FROM distributors WHERE name = 'Mouser'), '71-CRCW0805-10K-E3', 'https://www.mouser.com/ProductDetail/71-CRCW0805-10K-E3', 0.11, true, 80000),
    ((SELECT id FROM components WHERE part_number = 'RES-0002'), (SELECT id FROM distributors WHERE name = 'Arrow'), 'CRCW080510K0FKEA', 'https://www.arrow.com/en/products/crcw080510k0fkea', 0.09, true, 45000),
    ((SELECT id FROM components WHERE part_number = 'RES-0002'), (SELECT id FROM distributors WHERE name = 'Newark'), '58K8923', 'https://www.newark.com/vishay/crcw080510k0fkea', 0.12, true, 30000)
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

-- Resistor 3: Yageo RC0603FR-071KL - 1kΩ 0603
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url, status) 
VALUES (
    2, 'RES-0003',
    (SELECT id FROM manufacturers WHERE name = 'Yageo'),
    'RC0603FR-071KL',
    'RES SMD 1K OHM 1% 1/10W 0603',
    '1kΩ',
    'R_0603',
    '0603',
    'Chip Resistor',
    'Thick Film',
    'https://www.yageo.com/upload/media/product/productsearch/datasheet/rchip/PYu-RC_Group_51_RoHS_L_12.pdf',
    'Active'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-0003'), 
     (SELECT id FROM category_specifications WHERE category_id = 2 AND spec_name = 'Resistance'), '1000'),
    ((SELECT id FROM components WHERE part_number = 'RES-0003'), 
     (SELECT id FROM category_specifications WHERE category_id = 2 AND spec_name = 'Tolerance'), '1'),
    ((SELECT id FROM components WHERE part_number = 'RES-0003'), 
     (SELECT id FROM category_specifications WHERE category_id = 2 AND spec_name = 'Power Rating'), '0.1')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components WHERE part_number = 'RES-0003'), (SELECT id FROM distributors WHERE name = 'Digikey'), '311-1.00KHRCT-ND', 'https://www.digikey.com/product-detail/en/RC0603FR-071KL', 0.10, true, 75000),
    ((SELECT id FROM components WHERE part_number = 'RES-0003'), (SELECT id FROM distributors WHERE name = 'Mouser'), '603-RC0603FR-071KL', 'https://www.mouser.com/ProductDetail/603-RC0603FR-071KL', 0.11, true, 60000)
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

-- ============================================================================
-- CAPACITORS
-- ============================================================================

-- Capacitor 1: Kemet C0603C104K5RACTU - 0.1uF 50V 0603
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url, status) 
VALUES (
    1, 'CAP-0001',
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

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 1 AND spec_name = 'Capacitance'), '0.1'),
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 1 AND spec_name = 'Voltage Rating'), '50'),
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 1 AND spec_name = 'Tolerance'), '±10')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), (SELECT id FROM distributors WHERE name = 'Digikey'), '399-1096-1-ND', 'https://www.digikey.com/product-detail/en/C0603C104K5RACTU', 0.12, true, 250000),
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), (SELECT id FROM distributors WHERE name = 'Mouser'), '80-C0603C104K5R', 'https://www.mouser.com/ProductDetail/80-C0603C104K5R', 0.14, true, 180000),
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), (SELECT id FROM distributors WHERE name = 'Arrow'), 'C0603C104K5RACTU', 'https://www.arrow.com/en/products/c0603c104k5ractu', 0.13, true, 120000),
    ((SELECT id FROM components WHERE part_number = 'CAP-0001'), (SELECT id FROM distributors WHERE name = 'Newark'), '25C3880', 'https://www.newark.com/kemet/c0603c104k5ractu', 0.15, true, 90000)
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

-- Capacitor 2: Murata GRM188R71C225KA12D - 2.2uF 16V 0603
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url, status) 
VALUES (
    1, 'CAP-0002',
    (SELECT id FROM manufacturers WHERE name = 'Murata Electronics'),
    'GRM188R71C225KA12D',
    'CAP CER 2.2UF 16V X7R 0603',
    '2.2uF',
    'C_0603',
    '0603',
    'Ceramic',
    'X7R',
    'https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM188R71C225KA12-01.pdf',
    'Active'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-0002'), 
     (SELECT id FROM category_specifications WHERE category_id = 1 AND spec_name = 'Capacitance'), '2.2'),
    ((SELECT id FROM components WHERE part_number = 'CAP-0002'), 
     (SELECT id FROM category_specifications WHERE category_id = 1 AND spec_name = 'Voltage Rating'), '16'),
    ((SELECT id FROM components WHERE part_number = 'CAP-0002'), 
     (SELECT id FROM category_specifications WHERE category_id = 1 AND spec_name = 'Tolerance'), '±10')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-0002'), (SELECT id FROM distributors WHERE name = 'Digikey'), '490-3889-1-ND', 'https://www.digikey.com/product-detail/en/GRM188R71C225KA12D', 0.18, true, 140000),
    ((SELECT id FROM components WHERE part_number = 'CAP-0002'), (SELECT id FROM distributors WHERE name = 'Mouser'), '81-GRM188R71C225KA2D', 'https://www.mouser.com/ProductDetail/81-GRM188R71C225KA2D', 0.20, true, 120000),
    ((SELECT id FROM components WHERE part_number = 'CAP-0002'), (SELECT id FROM distributors WHERE name = 'Arrow'), 'GRM188R71C225KA12D', 'https://www.arrow.com/en/products/grm188r71c225ka12d', 0.19, true, 80000)
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

-- Capacitor 3: Samsung CL10A106KP8NNNC - 10uF 10V 0603
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url, status) 
VALUES (
    1, 'CAP-0003',
    (SELECT id FROM manufacturers WHERE name = 'Samsung Electro-Mechanics'),
    'CL10A106KP8NNNC',
    'CAP CER 10UF 10V X5R 0603',
    '10uF',
    'C_0603',
    '0603',
    'Ceramic',
    'X5R',
    'https://product.samsungsem.com/mlcc/CL10A106KP8NNNC.do',
    'Active'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-0003'), 
     (SELECT id FROM category_specifications WHERE category_id = 1 AND spec_name = 'Capacitance'), '10'),
    ((SELECT id FROM components WHERE part_number = 'CAP-0003'), 
     (SELECT id FROM category_specifications WHERE category_id = 1 AND spec_name = 'Voltage Rating'), '10'),
    ((SELECT id FROM components WHERE part_number = 'CAP-0003'), 
     (SELECT id FROM category_specifications WHERE category_id = 1 AND spec_name = 'Tolerance'), '±10')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components WHERE part_number = 'CAP-0003'), (SELECT id FROM distributors WHERE name = 'Digikey'), '1276-1946-1-ND', 'https://www.digikey.com/product-detail/en/CL10A106KP8NNNC', 0.22, true, 95000),
    ((SELECT id FROM components WHERE part_number = 'CAP-0003'), (SELECT id FROM distributors WHERE name = 'Mouser'), '187-CL10A106KP8NNNC', 'https://www.mouser.com/ProductDetail/187-CL10A106KP8NNNC', 0.24, true, 70000)
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

-- ============================================================================
-- INDUCTORS
-- ============================================================================

-- Inductor 1: Würth 744771110 - 10uH 1210
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url, status) 
VALUES (
    3, 'IND-0001',
    (SELECT id FROM manufacturers WHERE name = 'Würth Elektronik'),
    '744771110',
    'IND SMD 10UH 1.95A 1210',
    '10uH',
    'L_1210',
    '1210',
    'Power Inductor',
    'Shielded',
    'https://www.we-online.com/catalog/datasheet/744771110.pdf',
    'Active'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'IND-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 3 AND spec_name = 'Inductance'), '10e-6'),
    ((SELECT id FROM components WHERE part_number = 'IND-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 3 AND spec_name = 'Current Rating'), '1.95'),
    ((SELECT id FROM components WHERE part_number = 'IND-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 3 AND spec_name = 'Tolerance'), '±20'),
    ((SELECT id FROM components WHERE part_number = 'IND-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 3 AND spec_name = 'DC Resistance'), '0.086')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components WHERE part_number = 'IND-0001'), (SELECT id FROM distributors WHERE name = 'Digikey'), '732-2277-1-ND', 'https://www.digikey.com/product-detail/en/744771110', 0.58, true, 35000),
    ((SELECT id FROM components WHERE part_number = 'IND-0001'), (SELECT id FROM distributors WHERE name = 'Mouser'), '710-744771110', 'https://www.mouser.com/ProductDetail/710-744771110', 0.62, true, 28000),
    ((SELECT id FROM components WHERE part_number = 'IND-0001'), (SELECT id FROM distributors WHERE name = 'Arrow'), '744771110', 'https://www.arrow.com/en/products/744771110', 0.60, true, 15000),
    ((SELECT id FROM components WHERE part_number = 'IND-0001'), (SELECT id FROM distributors WHERE name = 'Newark'), '47AC6754', 'https://www.newark.com/wurth-elektronik/744771110', 0.65, true, 12000)
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

-- ============================================================================
-- DIODES
-- ============================================================================

-- Diode 1: Diodes Inc 1N4148W-7-F - SOD-123
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url, status) 
VALUES (
    4, 'DIODE-0001',
    (SELECT id FROM manufacturers WHERE name = 'Diodes Incorporated'),
    '1N4148W-7-F',
    'DIODE GEN PURP 100V 300MA SOD123',
    '100V',
    'D_SOD-123',
    'SOD-123',
    'Switching',
    'General Purpose',
    'https://www.diodes.com/assets/Datasheets/ds30086.pdf',
    'Active'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'DIODE-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 4 AND spec_name = 'Forward Voltage'), '1.0'),
    ((SELECT id FROM components WHERE part_number = 'DIODE-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 4 AND spec_name = 'Current Rating'), '0.3'),
    ((SELECT id FROM components WHERE part_number = 'DIODE-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 4 AND spec_name = 'Reverse Voltage'), '100')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components WHERE part_number = 'DIODE-0001'), (SELECT id FROM distributors WHERE name = 'Digikey'), '1N4148W-FDICT-ND', 'https://www.digikey.com/product-detail/en/1N4148W-7-F', 0.12, true, 180000),
    ((SELECT id FROM components WHERE part_number = 'DIODE-0001'), (SELECT id FROM distributors WHERE name = 'Mouser'), '621-1N4148W-F', 'https://www.mouser.com/ProductDetail/621-1N4148W-F', 0.13, true, 150000),
    ((SELECT id FROM components WHERE part_number = 'DIODE-0001'), (SELECT id FROM distributors WHERE name = 'Arrow'), '1N4148W-7-F', 'https://www.arrow.com/en/products/1n4148w-7-f', 0.11, true, 95000)
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

-- ============================================================================
-- TRANSISTORS / MOSFETs
-- ============================================================================

-- MOSFET 1: Infineon IRLML6402TRPBF - P-Channel SOT-23
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url, status) 
VALUES (
    5, 'FET-0001',
    (SELECT id FROM manufacturers WHERE name = 'Infineon Technologies'),
    'IRLML6402TRPBF',
    'MOSFET P-CH 20V 3.7A SOT-23',
    '-20V',
    'SOT-23',
    'SOT-23',
    'MOSFET',
    'P-Channel',
    'https://www.infineon.com/dgdl/irlml6402pbf.pdf',
    'Active'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'FET-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 5 AND spec_name = 'Transistor Type'), 'P-Channel MOSFET'),
    ((SELECT id FROM components WHERE part_number = 'FET-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 5 AND spec_name = 'VDS/VCE Max'), '-20'),
    ((SELECT id FROM components WHERE part_number = 'FET-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 5 AND spec_name = 'ID/IC Max'), '-3.7'),
    ((SELECT id FROM components WHERE part_number = 'FET-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 5 AND spec_name = 'RDS(on)'), '0.065')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components WHERE part_number = 'FET-0001'), (SELECT id FROM distributors WHERE name = 'Digikey'), 'IRLML6402TRPBFCT-ND', 'https://www.digikey.com/product-detail/en/IRLML6402TRPBF', 0.48, true, 85000),
    ((SELECT id FROM components WHERE part_number = 'FET-0001'), (SELECT id FROM distributors WHERE name = 'Mouser'), '942-IRLML6402TRPBF', 'https://www.mouser.com/ProductDetail/942-IRLML6402TRPBF', 0.52, true, 65000),
    ((SELECT id FROM components WHERE part_number = 'FET-0001'), (SELECT id FROM distributors WHERE name = 'Arrow'), 'IRLML6402TRPBF', 'https://www.arrow.com/en/products/irlml6402trpbf', 0.50, true, 45000),
    ((SELECT id FROM components WHERE part_number = 'FET-0001'), (SELECT id FROM distributors WHERE name = 'Newark'), '19M4584', 'https://www.newark.com/infineon/irlml6402trpbf', 0.55, true, 30000)
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

-- ============================================================================
-- INTEGRATED CIRCUITS
-- ============================================================================

-- IC 1: Texas Instruments LM358DR - Dual Op-Amp SOIC-8
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, datasheet_url, status) 
VALUES (
    6, 'IC-0001',
    (SELECT id FROM manufacturers WHERE name = 'Texas Instruments'),
    'LM358DR',
    'IC OPAMP DUAL GP 8-SOIC',
    'Dual Op-Amp',
    'SOIC-8',
    'SOIC-8',
    'Op-Amp',
    'General Purpose',
    'https://www.ti.com/lit/ds/symlink/lm358.pdf',
    'Active'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'IC-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 6 AND spec_name = 'Supply Voltage'), '3-32'),
    ((SELECT id FROM components WHERE part_number = 'IC-0001'), 
     (SELECT id FROM category_specifications WHERE category_id = 6 AND spec_name = 'Number of Channels'), '2')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components WHERE part_number = 'IC-0001'), (SELECT id FROM distributors WHERE name = 'Digikey'), '296-9640-1-ND', 'https://www.digikey.com/product-detail/en/LM358DR', 0.45, true, 120000),
    ((SELECT id FROM components WHERE part_number = 'IC-0001'), (SELECT id FROM distributors WHERE name = 'Mouser'), '595-LM358DR', 'https://www.mouser.com/ProductDetail/595-LM358DR', 0.48, true, 95000),
    ((SELECT id FROM components WHERE part_number = 'IC-0001'), (SELECT id FROM distributors WHERE name = 'Arrow'), 'LM358DR', 'https://www.arrow.com/en/products/lm358dr', 0.46, true, 75000),
    ((SELECT id FROM components WHERE part_number = 'IC-0001'), (SELECT id FROM distributors WHERE name = 'Newark'), '25C2839', 'https://www.newark.com/texas-instruments/lm358dr', 0.50, true, 60000)
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

-- IC 2: STMicroelectronics STM32F103C8T6 - MCU LQFP-48
INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, value, pcb_footprint, package_size, sub_category1, sub_category2, sub_category3, datasheet_url, status) 
VALUES (
    11, 'IC-0002',
    (SELECT id FROM manufacturers WHERE name = 'STMicroelectronics'),
    'STM32F103C8T6',
    'IC MCU 32BIT 64KB FLASH LQFP-48',
    'ARM Cortex-M3',
    'LQFP-48',
    'LQFP-48',
    'Microcontroller',
    'ARM Cortex-M3',
    '32-bit',
    'https://www.st.com/resource/en/datasheet/stm32f103c8.pdf',
    'Active'
)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ((SELECT id FROM components WHERE part_number = 'IC-0002'), 
     (SELECT id FROM category_specifications WHERE category_id = 6 AND spec_name = 'Supply Voltage'), '2.0-3.6'),
    ((SELECT id FROM components WHERE part_number = 'IC-0002'), 
     (SELECT id FROM category_specifications WHERE category_id = 6 AND spec_name = 'Operating Current'), '0.050')
ON CONFLICT (component_id, category_spec_id) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components WHERE part_number = 'IC-0002'), (SELECT id FROM distributors WHERE name = 'Digikey'), '497-6063-ND', 'https://www.digikey.com/product-detail/en/STM32F103C8T6', 4.52, true, 25000),
    ((SELECT id FROM components WHERE part_number = 'IC-0002'), (SELECT id FROM distributors WHERE name = 'Mouser'), '511-STM32F103C8T6', 'https://www.mouser.com/ProductDetail/511-STM32F103C8T6', 4.68, true, 18000),
    ((SELECT id FROM components WHERE part_number = 'IC-0002'), (SELECT id FROM distributors WHERE name = 'Arrow'), 'STM32F103C8T6', 'https://www.arrow.com/en/products/stm32f103c8t6', 4.55, true, 12000)
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

-- ============================================================================
-- ALTERNATIVE PARTS
-- ============================================================================

-- Alternative for RES-0001: Vishay equivalent
INSERT INTO components_alternative (part_number, manufacturer_id, manufacturer_pn) VALUES
    ('RES-0001', (SELECT id FROM manufacturers WHERE name = 'Vishay'), 'CRCW06032K20FKEA')
ON CONFLICT (part_number, manufacturer_id, manufacturer_pn) DO NOTHING;

INSERT INTO distributor_info (alternative_id, distributor_id, sku, url, price, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components_alternative WHERE part_number = 'RES-0001' AND manufacturer_pn = 'CRCW06032K20FKEA'), 
     (SELECT id FROM distributors WHERE name = 'Digikey'), '541-2.20KCCT-ND', 'https://www.digikey.com/product-detail/en/CRCW06032K20FKEA', 0.10, true, 45000),
    ((SELECT id FROM components_alternative WHERE part_number = 'RES-0001' AND manufacturer_pn = 'CRCW06032K20FKEA'), 
     (SELECT id FROM distributors WHERE name = 'Mouser'), '71-CRCW0603-2.2K-E3', 'https://www.mouser.com/ProductDetail/71-CRCW0603-2.2K-E3', 0.11, true, 38000)
ON CONFLICT (alternative_id, distributor_id, sku) DO NOTHING;

-- Alternative for CAP-0001: Samsung equivalent
INSERT INTO components_alternative (part_number, manufacturer_id, manufacturer_pn) VALUES
    ('CAP-0001', (SELECT id FROM manufacturers WHERE name = 'Samsung Electro-Mechanics'), 'CL10B104KB8NNNC')
ON CONFLICT (part_number, manufacturer_id, manufacturer_pn) DO NOTHING;

INSERT INTO distributor_info (alternative_id, distributor_id, sku, url, price, in_stock, stock_quantity) VALUES
    ((SELECT id FROM components_alternative WHERE part_number = 'CAP-0001' AND manufacturer_pn = 'CL10B104KB8NNNC'), 
     (SELECT id FROM distributors WHERE name = 'Digikey'), '1276-1003-1-ND', 'https://www.digikey.com/product-detail/en/CL10B104KB8NNNC', 0.11, true, 220000),
    ((SELECT id FROM components_alternative WHERE part_number = 'CAP-0001' AND manufacturer_pn = 'CL10B104KB8NNNC'), 
     (SELECT id FROM distributors WHERE name = 'Mouser'), '187-CL10B104KB8NNNC', 'https://www.mouser.com/ProductDetail/187-CL10B104KB8NNNC', 0.13, true, 175000),
    ((SELECT id FROM components_alternative WHERE part_number = 'CAP-0001' AND manufacturer_pn = 'CL10B104KB8NNNC'), 
     (SELECT id FROM distributors WHERE name = 'Arrow'), 'CL10B104KB8NNNC', 'https://www.arrow.com/en/products/cl10b104kb8nnnc', 0.12, true, 110000)
ON CONFLICT (alternative_id, distributor_id, sku) DO NOTHING;

-- ============================================================================
-- INVENTORY DATA
-- ============================================================================

INSERT INTO inventory (component_id, quantity, minimum_quantity, location)
SELECT 
    c.id,
    CASE 
        WHEN c.part_number = 'RES-0001' THEN 500
        WHEN c.part_number = 'RES-0002' THEN 300
        WHEN c.part_number = 'RES-0003' THEN 250
        WHEN c.part_number = 'CAP-0001' THEN 400
        WHEN c.part_number = 'CAP-0002' THEN 200
        WHEN c.part_number = 'CAP-0003' THEN 150
        WHEN c.part_number = 'IND-0001' THEN 100
        WHEN c.part_number = 'DIODE-0001' THEN 350
        WHEN c.part_number = 'FET-0001' THEN 120
        WHEN c.part_number = 'IC-0001' THEN 80
        WHEN c.part_number = 'IC-0002' THEN 25
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
WHERE c.part_number IN ('RES-0001', 'RES-0002', 'RES-0003', 'CAP-0001', 'CAP-0002', 'CAP-0003', 
                        'IND-0001', 'DIODE-0001', 'FET-0001', 'IC-0001', 'IC-0002')
ON CONFLICT (component_id) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    minimum_quantity = EXCLUDED.minimum_quantity,
    location = EXCLUDED.location;
