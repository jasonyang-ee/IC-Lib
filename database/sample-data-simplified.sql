-- ============================================================================
-- AllegroSQL Sample Data - Simplified Schema
-- ============================================================================
-- Sample components demonstrating the simplified single-table architecture
-- ============================================================================

-- Sample Manufacturers
INSERT INTO manufacturers (name, website) VALUES
    ('Murata', 'https://www.murata.com'),
    ('Samsung', 'https://www.samsung.com/semiconductor'),
    ('TDK', 'https://www.tdk.com'),
    ('AVX', 'https://www.avx.com'),
    ('Kemet', 'https://www.kemet.com'),
    ('Yageo', 'https://www.yageo.com'),
    ('Vishay', 'https://www.vishay.com'),
    ('Panasonic', 'https://industrial.panasonic.com'),
    ('KOA Speer', 'https://www.koaspeer.com'),
    ('Texas Instruments', 'https://www.ti.com'),
    ('NXP', 'https://www.nxp.com'),
    ('Microchip', 'https://www.microchip.com'),
    ('ON Semiconductor', 'https://www.onsemi.com'),
    ('Kingbright', 'https://www.kingbright.com'),
    ('Wurth', 'https://www.we-online.com'),
    ('Fairchild', 'https://www.onsemi.com'),
    ('Bourns', 'https://www.bourns.com'),
    ('Amphenol', 'https://www.amphenol.com'),
    ('JST', 'https://www.jst.com'),
    ('ECS', 'https://www.ecsxtal.com'),
    ('Abracon', 'https://abracon.com'),
    ('Silicon Labs', 'https://www.silabs.com'),
    ('Omron', 'https://www.omron.com'),
    ('TE Connectivity', 'https://www.te.com'),
    ('C&K', 'https://www.ckswitches.com'),
    ('E-Switch', 'https://www.e-switch.com'),
    ('CTS', 'https://www.ctscorp.com'),
    ('Pulse', 'https://www.pulseelectronics.com'),
    ('Littelfuse', 'https://www.littelfuse.com'),
    ('Espressif', 'https://www.espressif.com')
ON CONFLICT (name) DO NOTHING;

-- Sample Capacitors
INSERT INTO components (
    category_id, part_number, manufacturer_id, manufacturer_pn,
    description, value, pcb_footprint, package_size,
    sub_category1, sub_category2, status
) VALUES 
    (1, 'CAP-00001', 
     (SELECT id FROM manufacturers WHERE name = 'Murata'), 'GRM21BR61E106KA73L',
     '10uF Ceramic Capacitor X5R 25V', '10uF', 'C_0805', '0805',
     'Ceramic', 'X5R', 'Active'),
    
    (1, 'CAP-00002',
     (SELECT id FROM manufacturers WHERE name = 'Samsung'), 'CL10B104KB8NNNC',
     '100nF Ceramic Capacitor X7R 50V', '100nF', 'C_0603', '0603',
     'Ceramic', 'X7R', 'Active'),
    
    (1, 'CAP-00003',
     (SELECT id FROM manufacturers WHERE name = 'TDK'), 'C1005X7R1C105K050BC',
     '1uF Ceramic Capacitor X7R 16V', '1uF', 'C_0402', '0402',
     'Ceramic', 'X7R', 'Active'),
    
    (1, 'CAP-00004',
     (SELECT id FROM manufacturers WHERE name = 'AVX'), 'TAJB226K016RNJ',
     '22uF Tantalum Capacitor 16V', '22uF', 'C_1206', '1206',
     'Tantalum', NULL, 'Active'),
    
    (1, 'CAP-00005',
     (SELECT id FROM manufacturers WHERE name = 'Kemet'), 'C0603C471J5GACTU',
     '470pF Ceramic Capacitor C0G 50V', '470pF', 'C_0603', '0603',
     'Ceramic', 'C0G/NP0', 'Active')
ON CONFLICT (part_number) DO NOTHING;

-- Sample Resistors
INSERT INTO components (
    category_id, part_number, manufacturer_id, manufacturer_pn,
    description, value, pcb_footprint, package_size,
    sub_category1, sub_category2, status
) VALUES 
    (2, 'RES-00001',
     (SELECT id FROM manufacturers WHERE name = 'Yageo'), 'RC0603FR-0710KL',
     '10kΩ Thick Film Resistor', '10kΩ', 'R_0603', '0603',
     'Thick Film', '±1%', 'Active'),
    
    (2, 'RES-00002',
     (SELECT id FROM manufacturers WHERE name = 'Vishay'), 'CRCW0805100RFKEA',
     '100Ω Thick Film Resistor', '100Ω', 'R_0805', '0805',
     'Thick Film', '±1%', 'Active'),
    
    (2, 'RES-00003',
     (SELECT id FROM manufacturers WHERE name = 'Panasonic'), 'ERA-2AEB102X',
     '1kΩ Thin Film Resistor', '1kΩ', 'R_0402', '0402',
     'Thin Film', '±0.1%', 'Active'),
    
    (2, 'RES-00004',
     (SELECT id FROM manufacturers WHERE name = 'Yageo'), 'RC0603FR-074K7L',
     '4.7kΩ Thick Film Resistor', '4.7kΩ', 'R_0603', '0603',
     'Thick Film', '±1%', 'Active'),
    
    (2, 'RES-00005',
     (SELECT id FROM manufacturers WHERE name = 'KOA Speer'), 'RK73H2ATTD2200F',
     '220Ω Thick Film Resistor', '220Ω', 'R_0805', '0805',
     'Thick Film', '±1%', 'Active')
ON CONFLICT (part_number) DO NOTHING;

-- Sample ICs
INSERT INTO components (
    category_id, part_number, manufacturer_id, manufacturer_pn,
    description, value, pcb_footprint, package_size,
    sub_category1, sub_category2, status
) VALUES 
    (6, 'IC-00001',
     (SELECT id FROM manufacturers WHERE name = 'Texas Instruments'), 'LM358DR',
     'LM358 Dual Op-Amp', 'Dual Op-Amp', 'SOIC-8', 'SOIC-8',
     'Analog', 'Operational Amplifier', 'Active'),
    
    (6, 'IC-00002',
     (SELECT id FROM manufacturers WHERE name = 'NXP'), '74HC595PW',
     '74HC595 8-Bit Shift Register', '8-Bit Shift Register', 'TSSOP-16', 'TSSOP-16',
     'Logic', 'Shift Register', 'Active'),
    
    (6, 'IC-00003',
     (SELECT id FROM manufacturers WHERE name = 'Microchip'), 'ATMEGA328P-AU',
     'ATmega328P Microcontroller', 'MCU 8-bit 32KB Flash', 'TQFP-32', 'TQFP-32',
     'Microcontroller', '8-bit', 'Active'),
    
    (6, 'IC-00004',
     (SELECT id FROM manufacturers WHERE name = 'Texas Instruments'), 'LM1117IMPX-3.3',
     'LM1117-3.3 LDO Regulator', '3.3V 800mA LDO', 'SOT-223', 'SOT-223',
     'Power Management', 'LDO Regulator', 'Active'),
    
    (6, 'IC-00005',
     (SELECT id FROM manufacturers WHERE name = 'Espressif'), 'ESP32-WROOM-32D',
     'ESP32-WROOM-32 WiFi/BT Module', 'WiFi/BT Module', 'MODULE-38PIN', 'MODULE-38PIN',
     'Wireless', 'WiFi/Bluetooth', 'Active')
ON CONFLICT (part_number) DO NOTHING;

-- Sample Diodes
INSERT INTO components (
    category_id, part_number, manufacturer_id, manufacturer_pn,
    description, value, pcb_footprint, package_size,
    sub_category1, sub_category2, status
) VALUES 
    (4, 'DIODE-00001',
     (SELECT id FROM manufacturers WHERE name = 'ON Semiconductor'), '1N4148WT',
     '1N4148 Switching Diode', 'Switching Diode', 'SOD-323', 'SOD-323',
     'Switching', NULL, 'Active'),
    
    (4, 'DIODE-00002',
     (SELECT id FROM manufacturers WHERE name = 'Kingbright'), 'APT2012EC',
     'Red LED 2V 20mA', 'LED Red', 'LED-0805', '0805',
     'LED', 'Red', 'Active'),
    
    (4, 'DIODE-00003',
     (SELECT id FROM manufacturers WHERE name = 'Wurth'), '150060GS75000',
     'Green LED 3V 20mA', 'LED Green', 'LED-0603', '0603',
     'LED', 'Green', 'Active'),
    
    (4, 'DIODE-00004',
     (SELECT id FROM manufacturers WHERE name = 'Fairchild'), 'S1M',
     'S1M Rectifier Diode', 'Rectifier 1A 1000V', 'SMA', 'SMA',
     'Rectifier', NULL, 'Active'),
    
    (4, 'DIODE-00005',
     (SELECT id FROM manufacturers WHERE name = 'ON Semiconductor'), 'SS34',
     'SS34 Schottky Diode', 'Schottky 3A 40V', 'SMA', 'SMA',
     'Schottky', NULL, 'Active')
ON CONFLICT (part_number) DO NOTHING;

-- Sample Connectors
INSERT INTO components (
    category_id, part_number, manufacturer_id, manufacturer_pn,
    description, value, pcb_footprint, package_size,
    sub_category1, sub_category2, status
) VALUES 
    (7, 'CONN-00001',
     (SELECT id FROM manufacturers WHERE name = 'Amphenol'), '12401610E4#2A',
     'USB Type-C Receptacle', 'USB-C 16-pin', 'USB-C-16P', 'SMD',
     'USB', 'Type-C', 'Active'),
    
    (7, 'CONN-00002',
     (SELECT id FROM manufacturers WHERE name = 'Wurth'), '61301011121',
     '2.54mm Header 10-pin', 'Header 10-pin', 'HDR-2.54-10', 'THT',
     'Header', '2.54mm', 'Active'),
    
    (7, 'CONN-00003',
     (SELECT id FROM manufacturers WHERE name = 'JST'), 'B4B-XH-A',
     'JST-XH 4-pin Connector', 'JST-XH 4-pin', 'JST-XH-4', 'THT',
     'JST', 'XH Series', 'Active'),
    
    (7, 'CONN-00004',
     (SELECT id FROM manufacturers WHERE name = 'Amphenol'), 'RJHSE5080',
     'RJ45 Ethernet Jack', 'RJ45 Modular Jack', 'RJ45-8P8C', 'THT',
     'RJ45', 'Ethernet', 'Active')
ON CONFLICT (part_number) DO NOTHING;

-- ============================================================================
-- Component Specifications
-- ============================================================================

-- CAP-00001 specs
INSERT INTO component_specifications (component_id, spec_name, spec_value, unit)
SELECT c.id, 'Capacitance', '10', 'uF' FROM components c WHERE c.part_number = 'CAP-00001'
UNION ALL
SELECT c.id, 'Voltage Rating', '25', 'V' FROM components c WHERE c.part_number = 'CAP-00001'
UNION ALL
SELECT c.id, 'Tolerance', '±10', '%' FROM components c WHERE c.part_number = 'CAP-00001'
UNION ALL
SELECT c.id, 'Dielectric Type', 'X5R', NULL FROM components c WHERE c.part_number = 'CAP-00001'
UNION ALL
SELECT c.id, 'Temperature Range', '-55°C to +85°C', NULL FROM components c WHERE c.part_number = 'CAP-00001';

-- RES-00001 specs
INSERT INTO component_specifications (component_id, spec_name, spec_value, unit)
SELECT c.id, 'Resistance', '10', 'kΩ' FROM components c WHERE c.part_number = 'RES-00001'
UNION ALL
SELECT c.id, 'Tolerance', '±1', '%' FROM components c WHERE c.part_number = 'RES-00001'
UNION ALL
SELECT c.id, 'Power Rating', '0.1', 'W' FROM components c WHERE c.part_number = 'RES-00001'
UNION ALL
SELECT c.id, 'Temperature Coefficient', '±100', 'ppm/°C' FROM components c WHERE c.part_number = 'RES-00001';

-- IC-00001 specs
INSERT INTO component_specifications (component_id, spec_name, spec_value, unit)
SELECT c.id, 'Supply Voltage', '3-32', 'V' FROM components c WHERE c.part_number = 'IC-00001'
UNION ALL
SELECT c.id, 'Channels', '2', NULL FROM components c WHERE c.part_number = 'IC-00001'
UNION ALL
SELECT c.id, 'Gain Bandwidth Product', '1', 'MHz' FROM components c WHERE c.part_number = 'IC-00001'
UNION ALL
SELECT c.id, 'Slew Rate', '0.3', 'V/μs' FROM components c WHERE c.part_number = 'IC-00001';

-- IC-00003 specs
INSERT INTO component_specifications (component_id, spec_name, spec_value, unit)
SELECT c.id, 'Architecture', '8-bit AVR', NULL FROM components c WHERE c.part_number = 'IC-00003'
UNION ALL
SELECT c.id, 'Flash Memory', '32', 'KB' FROM components c WHERE c.part_number = 'IC-00003'
UNION ALL
SELECT c.id, 'SRAM', '2', 'KB' FROM components c WHERE c.part_number = 'IC-00003'
UNION ALL
SELECT c.id, 'EEPROM', '1', 'KB' FROM components c WHERE c.part_number = 'IC-00003'
UNION ALL
SELECT c.id, 'Clock Speed', '20', 'MHz' FROM components c WHERE c.part_number = 'IC-00003';

-- ============================================================================
-- Distributor Information
-- ============================================================================

-- CAP-00001 - Digikey
INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity, packaging)
SELECT 
    c.id,
    d.id,
    '490-1670-1-ND',
    'https://www.digikey.com/product-detail/en/murata-electronics/GRM21BR61E106KA73L/490-1670-1-ND/587771',
    0.12,
    true,
    15000,
    'Cut Tape'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'CAP-00001' AND d.name = 'Digikey';

-- CAP-00001 - Mouser
INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity, packaging)
SELECT 
    c.id,
    d.id,
    '81-GRM21BR61E106KA3L',
    'https://www.mouser.com/ProductDetail/Murata-Electronics/GRM21BR61E106KA73L',
    0.15,
    true,
    8500,
    'Tape & Reel'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'CAP-00001' AND d.name = 'Mouser';

-- CAP-00001 - Newark
INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity, packaging)
SELECT 
    c.id,
    d.id,
    '38AH8767',
    'https://www.newark.com/murata/grm21br61e106ka73l/cap-10uf-25v-10-x5r-0805/dp/38AH8767',
    0.14,
    true,
    5000,
    'Cut Tape'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'CAP-00001' AND d.name = 'Newark';

-- CAP-00001 - Arrow
INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity, packaging)
SELECT 
    c.id,
    d.id,
    'GRM21BR61E106KA73L',
    'https://www.arrow.com/en/products/grm21br61e106ka73l/murata-manufacturing',
    0.13,
    true,
    10000,
    'Tape & Reel'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'CAP-00001' AND d.name = 'Arrow';

-- Continue with more sample distributor data for other components...
-- (abbreviated for brevity, but pattern is the same)

-- RES-00001 - All distributors
INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity, packaging)
SELECT c.id, d.id, '311-10.0KHRCT-ND', 'https://www.digikey.com/product-detail/RC0603FR-0710KL', 0.01, true, 100000, 'Cut Tape'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'RES-00001' AND d.name = 'Digikey'
UNION ALL
SELECT c.id, d.id, '603-RC0603FR-0710KL', 'https://www.mouser.com/ProductDetail/RC0603FR-0710KL', 0.01, true, 75000, 'Tape & Reel'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'RES-00001' AND d.name = 'Mouser'
UNION ALL
SELECT c.id, d.id, '58K4785', 'https://www.newark.com/yageo/rc0603fr-0710kl', 0.01, true, 50000, 'Cut Tape'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'RES-00001' AND d.name = 'Newark'
UNION ALL
SELECT c.id, d.id, 'RC0603FR-0710KL', 'https://www.arrow.com/en/products/rc0603fr-0710kl/yageo', 0.01, true, 60000, 'Tape & Reel'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'RES-00001' AND d.name = 'Arrow';

-- IC-00001 - All distributors
INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity, packaging)
SELECT c.id, d.id, '296-14592-1-ND', 'https://www.digikey.com/product-detail/LM358DR', 0.35, true, 25000, 'Tape & Reel'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'IC-00001' AND d.name = 'Digikey'
UNION ALL
SELECT c.id, d.id, '595-LM358DR', 'https://www.mouser.com/ProductDetail/LM358DR', 0.38, true, 18000, 'Tape & Reel'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'IC-00001' AND d.name = 'Mouser'
UNION ALL
SELECT c.id, d.id, '91K2366', 'https://www.newark.com/texas-instruments/lm358dr', 0.36, true, 12000, 'Tape & Reel'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'IC-00001' AND d.name = 'Newark'
UNION ALL
SELECT c.id, d.id, 'LM358DR', 'https://www.arrow.com/en/products/lm358dr/texas-instruments', 0.34, true, 15000, 'Tape & Reel'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'IC-00001' AND d.name = 'Arrow';

-- IC-00003 - All distributors
INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity, packaging)
SELECT c.id, d.id, 'ATMEGA328P-AU-ND', 'https://www.digikey.com/product-detail/ATMEGA328P-AU', 2.15, true, 5000, 'Tape & Reel'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'IC-00003' AND d.name = 'Digikey'
UNION ALL
SELECT c.id, d.id, '556-ATMEGA328P-AU', 'https://www.mouser.com/ProductDetail/ATMEGA328P-AU', 2.20, true, 3500, 'Tape & Reel'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'IC-00003' AND d.name = 'Mouser'
UNION ALL
SELECT c.id, d.id, '77AC0746', 'https://www.newark.com/microchip/atmega328p-au', 2.18, true, 2000, 'Tape & Reel'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'IC-00003' AND d.name = 'Newark'
UNION ALL
SELECT c.id, d.id, 'ATMEGA328P-AU', 'https://www.arrow.com/en/products/atmega328p-au/microchip-technology', 2.12, true, 4000, 'Tape & Reel'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'IC-00003' AND d.name = 'Arrow';

-- CONN-00001 - All distributors
INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantity, packaging)
SELECT c.id, d.id, '609-5394-1-ND', 'https://www.digikey.com/product-detail/12401610E4-2A', 1.25, true, 12000, 'Tape & Reel'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'CONN-00001' AND d.name = 'Digikey'
UNION ALL
SELECT c.id, d.id, '649-12401610E42A', 'https://www.mouser.com/ProductDetail/12401610E4-2A', 1.28, true, 8000, 'Tape & Reel'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'CONN-00001' AND d.name = 'Mouser'
UNION ALL
SELECT c.id, d.id, '04WX8801', 'https://www.newark.com/amphenol/12401610e4-2a', 1.30, true, 5000, 'Tape & Reel'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'CONN-00001' AND d.name = 'Newark'
UNION ALL
SELECT c.id, d.id, '12401610E4#2A', 'https://www.arrow.com/en/products/12401610e42a/amphenol-icc', 1.22, true, 7000, 'Tape & Reel'
FROM components c CROSS JOIN distributors d WHERE c.part_number = 'CONN-00001' AND d.name = 'Arrow';

-- ============================================================================
-- Sample Inventory
-- ============================================================================

INSERT INTO inventory (component_id, location, quantity, minimum_quantity)
SELECT c.id, 'Shelf A1', 100, 50 FROM components c WHERE c.part_number = 'CAP-00001'
UNION ALL
SELECT c.id, 'Shelf A2', 200, 100 FROM components c WHERE c.part_number = 'RES-00001'
UNION ALL
SELECT c.id, 'Shelf B1', 25, 10 FROM components c WHERE c.part_number = 'IC-00001'
UNION ALL
SELECT c.id, 'Shelf B2', 15, 10 FROM components c WHERE c.part_number = 'IC-00003'
UNION ALL
SELECT c.id, 'Shelf C1', 50, 20 FROM components c WHERE c.part_number = 'CONN-00001';
