-- ============================================================================
-- AllegroSQL Sample Data - OrCAD CIS Compatible
-- ============================================================================
-- This file contains sample components to demonstrate the database structure
-- Components are inserted into category-specific tables, and triggers
-- automatically synchronize them to the master components table
-- ============================================================================

-- Sample Capacitors
INSERT INTO capacitors (
    part_number, description, value, pcb_footprint, manufacturer, manufacturer_pn,
    package_size, company_part_status, dielectric_type, tolerance, rated_voltage
) VALUES 
    ('CAP-001', '10uF Ceramic Capacitor X5R 25V', '10uF', 'C_0805', 'Murata', 'GRM21BR61E106KA73L', 
     '0805', 'Active', 'X5R', '±10%', '25V'),
    ('CAP-002', '100nF Ceramic Capacitor X7R 50V', '100nF', 'C_0603', 'Samsung', 'CL10B104KB8NNNC', 
     '0603', 'Active', 'X7R', '±10%', '50V'),
    ('CAP-003', '1uF Ceramic Capacitor X7R 16V', '1uF', 'C_0402', 'TDK', 'C1005X7R1C105K050BC', 
     '0402', 'Active', 'X7R', '±10%', '16V'),
    ('CAP-004', '22uF Tantalum Capacitor 16V', '22uF', 'C_1206', 'AVX', 'TAJB226K016RNJ', 
     '1206', 'Active', 'Tantalum', '±10%', '16V'),
    ('CAP-005', '470pF Ceramic Capacitor C0G 50V', '470pF', 'C_0603', 'Kemet', 'C0603C471J5GACTU', 
     '0603', 'Active', 'C0G/NP0', '±5%', '50V')
ON CONFLICT (part_number) DO NOTHING;

-- Sample Resistors
INSERT INTO resistors (
    part_number, description, value, pcb_footprint, manufacturer, manufacturer_pn,
    package_size, company_part_status, resistance, tolerance, power_rating, resistor_type
) VALUES 
    ('RES-001', '10kΩ Thick Film Resistor', '10kΩ', 'R_0603', 'Yageo', 'RC0603FR-0710KL', 
     '0603', 'Active', '10kΩ', '±1%', '0.1W', 'Thick Film'),
    ('RES-002', '100Ω Thick Film Resistor', '100Ω', 'R_0805', 'Vishay', 'CRCW0805100RFKEA', 
     '0805', 'Active', '100Ω', '±1%', '0.125W', 'Thick Film'),
    ('RES-003', '1kΩ Thin Film Resistor', '1kΩ', 'R_0402', 'Panasonic', 'ERA-2AEB102X', 
     '0402', 'Active', '1kΩ', '±0.1%', '0.063W', 'Thin Film'),
    ('RES-004', '4.7kΩ Thick Film Resistor', '4.7kΩ', 'R_0603', 'Yageo', 'RC0603FR-074K7L', 
     '0603', 'Active', '4.7kΩ', '±1%', '0.1W', 'Thick Film'),
    ('RES-005', '220Ω Thick Film Resistor', '220Ω', 'R_0805', 'KOA Speer', 'RK73H2ATTD2200F', 
     '0805', 'Active', '220Ω', '±1%', '0.125W', 'Thick Film')
ON CONFLICT (part_number) DO NOTHING;

-- Sample ICs
INSERT INTO ics (
    part_number, description, value, pcb_footprint, manufacturer, manufacturer_pn,
    package_size, company_part_status, ic_type, pin_count, supply_voltage, interface_type
) VALUES 
    ('IC-001', 'LM358 Dual Op-Amp', 'Dual Op-Amp', 'SOIC-8', 'Texas Instruments', 'LM358DR', 
     'SOIC-8', 'Active', 'Analog', '8', '3V-32V', 'Analog'),
    ('IC-002', '74HC595 8-Bit Shift Register', '8-Bit Shift Register', 'TSSOP-16', 'NXP', '74HC595PW', 
     'TSSOP-16', 'Active', 'Logic', '16', '2V-6V', 'SPI'),
    ('IC-003', 'ATmega328P Microcontroller', 'MCU 8-bit 32KB Flash', 'TQFP-32', 'Microchip', 'ATMEGA328P-AU', 
     'TQFP-32', 'Active', 'Microcontroller', '32', '1.8V-5.5V', 'UART/SPI/I2C'),
    ('IC-004', 'LM1117-3.3 LDO Regulator', '3.3V 800mA LDO', 'SOT-223', 'Texas Instruments', 'LM1117IMPX-3.3', 
     'SOT-223', 'Active', 'Power Management', '4', '4.75V-15V', 'Analog'),
    ('IC-005', 'ESP32-WROOM-32 WiFi/BT Module', 'WiFi/BT Module', 'MODULE-38PIN', 'Espressif', 'ESP32-WROOM-32D', 
     'MODULE-38PIN', 'Active', 'Wireless', '38', '3.0V-3.6V', 'UART/SPI/I2C')
ON CONFLICT (part_number) DO NOTHING;

-- Sample Diodes
INSERT INTO diodes (
    part_number, description, value, pcb_footprint, manufacturer, manufacturer_pn,
    package_size, company_part_status, diode_type, forward_voltage, reverse_voltage, color
) VALUES 
    ('DIODE-001', '1N4148 Switching Diode', 'Switching Diode', 'SOD-323', 'ON Semiconductor', '1N4148WT', 
     'SOD-323', 'Active', 'Switching', '1V', '100V', NULL),
    ('DIODE-002', 'Red LED 2V 20mA', 'LED Red', 'LED-0805', 'Kingbright', 'APT2012EC', 
     '0805', 'Active', 'LED', '2V', NULL, 'Red'),
    ('DIODE-003', 'Green LED 3V 20mA', 'LED Green', 'LED-0603', 'Wurth', '150060GS75000', 
     '0603', 'Active', 'LED', '3V', NULL, 'Green'),
    ('DIODE-004', 'S1M Rectifier Diode', 'Rectifier 1A 1000V', 'SMA', 'Fairchild', 'S1M', 
     'SMA', 'Active', 'Rectifier', '1.1V', '1000V', NULL),
    ('DIODE-005', 'SS34 Schottky Diode', 'Schottky 3A 40V', 'SMA', 'ON Semiconductor', 'SS34', 
     'SMA', 'Active', 'Schottky', '0.5V', '40V', NULL)
ON CONFLICT (part_number) DO NOTHING;

-- Sample Inductors
INSERT INTO inductors (
    part_number, description, value, pcb_footprint, manufacturer, manufacturer_pn,
    package_size, company_part_status, inductance, tolerance, current_rating, dc_resistance
) VALUES 
    ('IND-001', '10uH Power Inductor 3A', '10uH', 'IND_4x4', 'Bourns', 'SRR1260-100M', 
     '4x4mm', 'Active', '10uH', '±20%', '3A', '0.025Ω'),
    ('IND-002', '47uH Inductor 1A', '47uH', 'IND_3x3', 'TDK', 'VLS3012ET-470M', 
     '3x3mm', 'Active', '47uH', '±20%', '1A', '0.18Ω'),
    ('IND-003', '100uH Inductor 500mA', '100uH', 'IND_0805', 'Murata', 'LQM2MPN100MG0', 
     '0805', 'Active', '100uH', '±20%', '0.5A', '0.45Ω')
ON CONFLICT (part_number) DO NOTHING;

-- Sample Connectors
INSERT INTO connectors (
    part_number, description, value, pcb_footprint, manufacturer, manufacturer_pn,
    package_size, company_part_status, num_contacts, pitch, contact_plating
) VALUES 
    ('CONN-001', 'USB Type-C Receptacle', 'USB-C 16-pin', 'USB-C-16P', 'Amphenol', '12401610E4#2A', 
     'SMD', 'Active', '16', '0.5mm', 'Gold'),
    ('CONN-002', '2.54mm Header 10-pin', 'Header 10-pin', 'HDR-2.54-10', 'Wurth', '61301011121', 
     'THT', 'Active', '10', '2.54mm', 'Tin'),
    ('CONN-003', 'JST-XH 4-pin Connector', 'JST-XH 4-pin', 'JST-XH-4', 'JST', 'B4B-XH-A', 
     'THT', 'Active', '4', '2.5mm', 'Tin'),
    ('CONN-004', 'RJ45 Ethernet Jack', 'RJ45 Modular Jack', 'RJ45-8P8C', 'Amphenol', 'RJHSE5080', 
     'THT', 'Active', '8', '1.02mm', 'Gold')
ON CONFLICT (part_number) DO NOTHING;

-- Sample Crystals
INSERT INTO crystals_and_oscillators (
    part_number, description, value, pcb_footprint, manufacturer, manufacturer_pn,
    package_size, company_part_status, frequency_tolerance, load_capacitance
) VALUES 
    ('XTAL-001', '16MHz Crystal HC-49S', '16MHz', 'XTAL-HC49', 'ECS', 'ECS-160-20-4X', 
     'HC-49S', 'Active', '±30ppm', '20pF'),
    ('XTAL-002', '32.768kHz Crystal', '32.768kHz', 'XTAL-3215', 'Abracon', 'ABS07-32.768KHZ-T', 
     '3.2x1.5mm', 'Active', '±20ppm', '12.5pF'),
    ('XTAL-003', '25MHz Oscillator', '25MHz', 'OSC-5x3', 'Silicon Labs', 'SiT8008AI-33-33E-25.000000', 
     '5x3.2mm', 'Active', '±50ppm', NULL)
ON CONFLICT (part_number) DO NOTHING;

-- Sample Relays
INSERT INTO relays (
    part_number, description, value, pcb_footprint, manufacturer, manufacturer_pn,
    package_size, company_part_status, coil_voltage, contact_configuration
) VALUES 
    ('RELAY-001', '5V SPDT Relay 10A', '5V SPDT', 'RELAY-5PIN', 'Omron', 'G5Q-1A4-EU DC5', 
     'SMD', 'Active', '5V', 'SPDT'),
    ('RELAY-002', '12V DPDT Relay 5A', '12V DPDT', 'RELAY-8PIN', 'TE Connectivity', 'RT314012', 
     'THT', 'Active', '12V', 'DPDT')
ON CONFLICT (part_number) DO NOTHING;

-- Sample Switches
INSERT INTO switches (
    part_number, description, value, pcb_footprint, manufacturer, manufacturer_pn,
    package_size, company_part_status, switch_type, contact_configuration
) VALUES 
    ('SW-001', 'Tactile Switch 6x6mm', 'Tactile SPST', 'SW_6x6', 'C&K', 'PTS645SH50SMTR92LFS', 
     '6x6mm', 'Active', 'Tactile', 'SPST-NO'),
    ('SW-002', 'Slide Switch SPDT', 'Slide SPDT', 'SW_SLIDE', 'E-Switch', 'EG1218', 
     'THT', 'Active', 'Slide', 'SPDT'),
    ('SW-003', 'DIP Switch 4-position', 'DIP 4-pos', 'DIP-8', 'CTS', '206-4MST', 
     'THT', 'Active', 'DIP', '4x SPST')
ON CONFLICT (part_number) DO NOTHING;

-- Sample Transformers
INSERT INTO transformers (
    part_number, description, value, pcb_footprint, manufacturer, manufacturer_pn,
    package_size, company_part_status, primary_voltage, secondary_voltage, power_rating
) VALUES 
    ('XFMR-001', 'Ethernet Transformer 10/100', 'Ethernet', 'XFMR-SMD', 'Pulse', 'H5007NL', 
     'SMD', 'Active', '5V', '5V', '350mW')
ON CONFLICT (part_number) DO NOTHING;

-- Sample Misc Components
INSERT INTO misc (
    part_number, description, value, pcb_footprint, manufacturer, manufacturer_pn,
    package_size, company_part_status, component_type
) VALUES 
    ('MISC-001', 'Ferrite Bead 600Ω@100MHz', '600Ω@100MHz', 'FB_0805', 'Murata', 'BLM21PG600SN1D', 
     '0805', 'Active', 'Ferrite Bead'),
    ('MISC-002', 'Fuse 500mA Fast', '500mA', 'FUSE_1206', 'Littelfuse', '0451.500MRL', 
     '1206', 'Active', 'Fuse'),
    ('MISC-003', 'TVS Diode 5V', '5V TVS', 'SOD-323', 'Bourns', 'CDSOD323-T05C', 
     'SOD-323', 'Active', 'TVS Diode')
ON CONFLICT (part_number) DO NOTHING;

-- ============================================================================
-- Note: Components are automatically synchronized to the components table
-- via triggers. No need to insert into components table manually.
-- ============================================================================

-- ============================================================================
-- Distributor Data
-- ============================================================================

-- Insert distributors
INSERT INTO distributors (name, api_endpoint) VALUES
    ('Digikey', 'https://api.digikey.com/v1'),
    ('Mouser', 'https://api.mouser.com/api/v1'),
    ('Newark', 'https://api.newark.com/v1'),
    ('Arrow', 'https://api.arrow.com/v1'),
    ('LCSC', 'https://cart.lcsc.com')
ON CONFLICT (name) DO NOTHING;

-- Add distributor information for sample components
-- First we need to get component IDs and distributor IDs via joins
INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity, minimum_order_quantity, packaging)
SELECT 
    c.id,
    d.id,
    'GRM21BR61E106KA73L',
    'https://www.digikey.com/product-detail/en/murata-electronics/GRM21BR61E106KA73L/490-1670-1-ND/587771',
    0.12,
    'USD',
    true,
    15000,
    1,
    'Cut Tape'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'CAP-001' AND d.name = 'Digikey'
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity, minimum_order_quantity, packaging)
SELECT 
    c.id,
    d.id,
    '81-GRM21BR61E106KA3L',
    'https://www.mouser.com/ProductDetail/Murata-Electronics/GRM21BR61E106KA73L',
    0.15,
    'USD',
    true,
    8500,
    1,
    'Tape & Reel'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'CAP-001' AND d.name = 'Mouser'
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity, minimum_order_quantity, packaging)
SELECT 
    c.id,
    d.id,
    'CL10B104KB8NNNC',
    'https://www.digikey.com/product-detail/en/samsung-electro-mechanics/CL10B104KB8NNNC/1276-1006-1-ND/3889092',
    0.02,
    'USD',
    true,
    50000,
    1,
    'Cut Tape'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'CAP-002' AND d.name = 'Digikey'
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity, minimum_order_quantity, packaging)
SELECT 
    c.id,
    d.id,
    'RC0603FR-0710KL',
    'https://www.digikey.com/product-detail/en/yageo/RC0603FR-0710KL/311-10.0KHRCT-ND/729790',
    0.01,
    'USD',
    true,
    100000,
    1,
    'Cut Tape'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'RES-001' AND d.name = 'Digikey'
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity, minimum_order_quantity, packaging)
SELECT 
    c.id,
    d.id,
    '603-RC0603FR-0710KL',
    'https://www.mouser.com/ProductDetail/Yageo/RC0603FR-0710KL',
    0.01,
    'USD',
    true,
    75000,
    1,
    'Tape & Reel'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'RES-001' AND d.name = 'Mouser'
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity, minimum_order_quantity, packaging)
SELECT 
    c.id,
    d.id,
    'CRCW0805100RFKEA',
    'https://www.digikey.com/product-detail/en/vishay-dale/CRCW0805100RFKEA/541-100CCT-ND/1179956',
    0.01,
    'USD',
    true,
    85000,
    1,
    'Cut Tape'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'RES-002' AND d.name = 'Digikey'
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity, minimum_order_quantity, packaging)
SELECT 
    c.id,
    d.id,
    'LM358DR',
    'https://www.digikey.com/product-detail/en/texas-instruments/LM358DR/296-14592-1-ND/382296',
    0.35,
    'USD',
    true,
    25000,
    1,
    'Tape & Reel'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'IC-001' AND d.name = 'Digikey'
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity, minimum_order_quantity, packaging)
SELECT 
    c.id,
    d.id,
    '595-LM358DR',
    'https://www.mouser.com/ProductDetail/Texas-Instruments/LM358DR',
    0.38,
    'USD',
    true,
    18000,
    1,
    'Tape & Reel'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'IC-001' AND d.name = 'Mouser'
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity, minimum_order_quantity, packaging)
SELECT 
    c.id,
    d.id,
    'ATMEGA328P-AU',
    'https://www.digikey.com/product-detail/en/microchip-technology/ATMEGA328P-AU/ATMEGA328P-AU-ND/1914589',
    2.15,
    'USD',
    true,
    5000,
    1,
    'Tape & Reel'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'IC-003' AND d.name = 'Digikey'
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity, minimum_order_quantity, packaging)
SELECT 
    c.id,
    d.id,
    '1N4148WT',
    'https://www.digikey.com/product-detail/en/on-semiconductor/1N4148WT/1N4148WTCT-ND/965333',
    0.05,
    'USD',
    true,
    30000,
    1,
    'Cut Tape'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'DIODE-001' AND d.name = 'Digikey'
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity, minimum_order_quantity, packaging)
SELECT 
    c.id,
    d.id,
    '12401610E4#2A',
    'https://www.digikey.com/product-detail/en/amphenol-icc-fci/12401610E4-2A/609-5394-1-ND/5376773',
    1.25,
    'USD',
    true,
    12000,
    1,
    'Tape & Reel'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'CONN-001' AND d.name = 'Digikey'
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;

INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, currency, in_stock, stock_quantity, minimum_order_quantity, packaging)
SELECT 
    c.id,
    d.id,
    'C29944',
    'https://lcsc.com/product-detail/USB-Type-C_Amphenol-ICC-12401610E4-2A_C29944.html',
    0.89,
    'USD',
    true,
    8500,
    1,
    'Tape & Reel'
FROM components c
CROSS JOIN distributors d
WHERE c.part_number = 'CONN-001' AND d.name = 'LCSC'
ON CONFLICT (component_id, distributor_id, sku) DO NOTHING;
