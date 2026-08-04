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

INSERT INTO eco_approval_stages (stage_name, stage_order, required_approvals, required_role, pipeline_types)
SELECT 'Review & Approval', 1, 1, 'approver', '{proto_status_change,prod_status_change,spec,filename,shared_file_rename,distributor,alt_parts}'::text[]
WHERE NOT EXISTS (SELECT 1 FROM eco_approval_stages);

-- ============================================================================
-- Default ECO Settings
-- ============================================================================

INSERT INTO eco_settings (prefix, leading_zeros, next_number)
SELECT 'ECO-', 1, 1
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
    eco_logo_filename VARCHAR(200) DEFAULT '',
    eco_pdf_header_text VARCHAR(200) DEFAULT 'Engineer Change Order',
    eco_complete_notification_email VARCHAR(255) DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_settings_singleton ON admin_settings((1));

INSERT INTO admin_settings (global_prefix_enabled, global_prefix, global_leading_zeros, eco_logo_filename, eco_pdf_header_text, eco_complete_notification_email)
SELECT false, '', 5, '', 'Engineer Change Order', ''
WHERE NOT EXISTS (SELECT 1 FROM admin_settings);

-- ============================================================================
-- Default Package Catalog
-- ============================================================================

INSERT INTO packages (short_name, family, mount, count_policy, is_builtin, display_order) VALUES
    ('SOT-23-3', 'SOT', 'SMT', 'embedded', true, 1),
    ('SOT-323', 'SOT', 'SMT', 'embedded', true, 2),
    ('SOT-416', 'SOT', 'SMT', 'embedded', true, 3),
    ('SOT-23-5', 'SOT', 'SMT', 'embedded', true, 4),
    ('TSOT-23-5', 'TSOT', 'SMT', 'embedded', true, 5),
    ('SOT-353', 'SOT', 'SMT', 'embedded', true, 6),
    ('SOT-23-6', 'SOT', 'SMT', 'embedded', true, 7),
    ('SOT-363', 'SOT', 'SMT', 'embedded', true, 8),
    ('SOT-563', 'SOT', 'SMT', 'embedded', true, 9),
    ('SOT-23-4', 'SOT', 'SMT', 'embedded', true, 10),
    ('SOT-490', 'SOT', 'SMT', 'embedded', true, 11),
    ('SOT-89-3', 'SOT', 'SMT', 'embedded', true, 12),
    ('SOT-223-4', 'SOT', 'SMT', 'embedded', true, 13),
    ('SOT-223-8', 'SOT', 'SMT', 'embedded', true, 14),
    ('SOT-23-8', 'SOT', 'SMT', 'embedded', true, 15),
    ('TO-92', 'TO', 'TH', 'none', true, 16),
    ('SMA', 'DO-214', 'SMT', 'none', true, 17),
    ('DO-201', 'DO-201', 'TH', 'none', true, 18),
    ('DO-214', 'DO-214', 'SMT', 'none', true, 19),
    ('SMB', 'DO-214', 'SMT', 'none', true, 20),
    ('SMC', 'DO-214', 'SMT', 'none', true, 21),
    ('GF1', 'DO-214', 'SMT', 'none', true, 22),
    ('DO-41', 'DO-204', 'TH', 'none', true, 23),
    ('DO-35', 'DO-204', 'TH', 'none', true, 24),
    ('DO-15', 'DO-204', 'TH', 'none', true, 25),
    ('SOD-68', 'SOD', 'TH', 'none', true, 26),
    ('MiniMELF', 'DO-213', 'SMT', 'none', true, 27),
    ('MELF', 'DO-213', 'SMT', 'none', true, 28),
    ('SOD-123', 'SOD', 'SMT', 'none', true, 29),
    ('SOD-323', 'SOD', 'SMT', 'none', true, 30),
    ('SOD-523', 'SOD', 'SMT', 'none', true, 31),
    ('SOD-723', 'SOD', 'SMT', 'none', true, 32),
    ('SOD-923', 'SOD', 'SMT', 'none', true, 33),
    ('DPAK', 'TO', 'SMT', 'none', true, 34),
    ('D2PAK', 'TO', 'SMT', 'none', true, 35),
    ('IPAK', 'TO', 'TH', 'none', true, 36),
    ('I2PAK', 'TO', 'TH', 'none', true, 37),
    ('D3PAK', 'TO', 'TH', 'none', true, 38),
    ('TO-273', 'TO', 'TH', 'none', true, 39),
    ('TO-274', 'TO', 'TH', 'none', true, 40),
    ('TO-277', 'TO', 'SMT', 'none', true, 41),
    ('DFN', 'DFN', 'SMT', 'append', true, 42),
    ('WCSP', 'WLCSP', 'WAFER', 'append', true, 43),
    ('MSOP', 'MSOP', 'SMT', 'append', true, 44),
    ('SSOP', 'SSOP', 'SMT', 'append', true, 45),
    ('TSSOP', 'TSSOP', 'SMT', 'append', true, 46),
    ('HTSSOP', 'TSSOP', 'SMT', 'append', true, 47),
    ('HSOP', 'SOP', 'SMT', 'append', true, 48),
    ('HTQFP', 'QFP', 'SMT', 'append', true, 49),
    ('HVQFP', 'QFP', 'SMT', 'append', true, 50),
    ('HLQFP', 'QFP', 'SMT', 'append', true, 51),
    ('HQFP', 'QFP', 'SMT', 'append', true, 52),
    ('LQFP', 'QFP', 'SMT', 'append', true, 53),
    ('TQFP', 'QFP', 'SMT', 'append', true, 54),
    ('VQFP', 'QFP', 'SMT', 'append', true, 55),
    ('VQFN', 'QFN', 'SMT', 'append', true, 56),
    ('VFQFN', 'QFN', 'SMT', 'append', true, 57),
    ('MQFP', 'QFP', 'SMT', 'append', true, 58),
    ('CDIP', 'DIP', 'TH', 'append', true, 59),
    ('PDIP', 'DIP', 'TH', 'append', true, 60),
    ('SDIP', 'DIP', 'TH', 'append', true, 61),
    ('SOIC', 'SOIC', 'SMT', 'append', true, 62),
    ('VSSR', 'VSSR', 'SMT', 'append', true, 63),
    ('VTSR', 'VTSR', 'SMT', 'append', true, 64),
    ('TO-3', 'TO', 'TH', 'none', true, 65),
    ('TO-5', 'TO', 'TH', 'none', true, 66),
    ('TO-8', 'TO', 'TH', 'none', true, 67),
    ('TO-18', 'TO', 'TH', 'none', true, 68),
    ('TO-39', 'TO', 'TH', 'none', true, 69),
    ('TO-66', 'TO', 'TH', 'none', true, 70),
    ('TO-126', 'TO', 'TH', 'none', true, 71),
    ('TO-202', 'TO', 'TH', 'none', true, 72),
    ('TO-220', 'TO', 'TH', 'none', true, 73),
    ('TO-247', 'TO', 'TH', 'none', true, 74),
    ('SIP', 'SIP', 'TH', 'append', true, 75),
    ('DIP', 'DIP', 'TH', 'append', true, 76),
    ('FlatPack', 'FlatPack', 'SMT', 'append', true, 77),
    ('SO', 'SO', 'SMT', 'append', true, 78),
    ('SOP', 'SOP', 'SMT', 'append', true, 79),
    ('HTSOP', 'SOP', 'SMT', 'append', true, 80),
    ('TSOP', 'TSOP', 'SMT', 'append', true, 81),
    ('ZIP', 'ZIP', 'TH', 'append', true, 82),
    ('LCC', 'LCC', 'SMT', 'append', true, 83),
    ('QIP', 'QIP', 'TH', 'append', true, 84),
    ('QIL', 'QIL', 'TH', 'append', true, 85),
    ('PLCC', 'PLCC', 'SMT', 'append', true, 86),
    ('QFN', 'QFN', 'SMT', 'append', true, 87),
    ('QFP', 'QFP', 'SMT', 'append', true, 88),
    ('QUIP', 'QUIP', 'TH', 'append', true, 89),
    ('QUIL', 'QUIL', 'TH', 'append', true, 90),
    ('BGA', 'BGA', 'SMT', 'append', true, 91),
    ('eWLB', 'WLCSP', 'WAFER', 'append', true, 92),
    ('LGA', 'LGA', 'SMT', 'append', true, 93),
    ('PGA', 'PGA', 'TH', 'append', true, 94),
    ('COB', 'COB', 'PANEL', 'none', true, 95),
    ('COF', 'COF', 'PANEL', 'none', true, 96),
    ('COG', 'COG', 'PANEL', 'none', true, 97),
    ('CSP', 'CSP', 'WAFER', 'append', true, 98),
    ('FlipChip', 'FlipChip', 'WAFER', 'append', true, 99),
    ('PoP', 'PoP', 'SMT', 'append', true, 100),
    ('QP', 'QP', 'SMT', 'append', true, 101),
    ('UICC', 'UICC', 'SMT', 'append', true, 102),
    ('WL-CSP', 'WLCSP', 'WAFER', 'append', true, 103),
    ('WLP', 'WLP', 'WAFER', 'append', true, 104),
    ('01005', 'chip', 'SMT', 'chip', true, 105),
    ('0201', 'chip', 'SMT', 'chip', true, 106),
    ('0402', 'chip', 'SMT', 'chip', true, 107),
    ('0603', 'chip', 'SMT', 'chip', true, 108),
    ('0805', 'chip', 'SMT', 'chip', true, 109),
    ('1206', 'chip', 'SMT', 'chip', true, 110),
    ('1210', 'chip', 'SMT', 'chip', true, 111),
    ('1806', 'chip', 'SMT', 'chip', true, 112),
    ('1812', 'chip', 'SMT', 'chip', true, 113),
    ('2010', 'chip', 'SMT', 'chip', true, 114),
    ('2512', 'chip', 'SMT', 'chip', true, 115),
    ('2920', 'chip', 'SMT', 'chip', true, 116)
ON CONFLICT (short_name) DO NOTHING;

-- Every canonical name is also an alias so all package resolution follows one path.
INSERT INTO package_aliases (package_id, alias)
SELECT packages.id, seeded_aliases.alias
FROM (VALUES
    ('SOT-23-3', 'SOT-23-3'),
    ('SOT-23-3', 'SOT23-3'),
    ('SOT-23-3', 'TO-236AB'),
    ('SOT-23-3', 'TO-236AA'),
    ('SOT-23-3', 'TO-236-3'),
    ('SOT-23-3', 'SOT346'),
    ('SOT-23-3', 'SC59A'),
    ('SOT-23-3', 'SMT3'),
    ('SOT-323', 'SOT-323'),
    ('SOT-323', 'SC70-3'),
    ('SOT-323', 'UMT3'),
    ('SOT-416', 'SOT-416'),
    ('SOT-416', 'SOT523'),
    ('SOT-416', 'SC75A'),
    ('SOT-416', 'SC90'),
    ('SOT-416', 'EMT3'),
    ('SOT-23-5', 'SOT-23-5'),
    ('SOT-23-5', 'SOT25'),
    ('SOT-23-5', 'SC74A'),
    ('SOT-23-5', 'TSOP-5'),
    ('SOT-23-5', 'SOT753'),
    ('SOT-23-5', 'MO-178AA'),
    ('SOT-23-5', 'SMT5'),
    ('TSOT-23-5', 'TSOT-23-5'),
    ('TSOT-23-5', 'SOT-23-5 Thin'),
    ('SOT-353', 'SOT-353'),
    ('SOT-353', 'SC70-5'),
    ('SOT-353', 'SC88A'),
    ('SOT-353', 'TSSOP-5'),
    ('SOT-353', 'UMT5'),
    ('SOT-23-6', 'SOT-23-6'),
    ('SOT-23-6', 'SOT26'),
    ('SOT-23-6', 'SC59-6'),
    ('SOT-23-6', 'SC74'),
    ('SOT-23-6', 'TSOP-6'),
    ('SOT-23-6', 'MO-178AB'),
    ('SOT-23-6', 'SMT6'),
    ('SOT-23-6', 'SM6'),
    ('SOT-23-6', 'Mini6'),
    ('SOT-23-6', 'SOT457'),
    ('SOT-363', 'SOT-363'),
    ('SOT-363', 'SC70-6'),
    ('SOT-363', 'SC88'),
    ('SOT-363', 'TSSOP-6'),
    ('SOT-363', 'UMT6'),
    ('SOT-363', 'US6'),
    ('SOT-363', 'S-Mini6'),
    ('SOT-563', 'SOT-563'),
    ('SOT-563', 'SC-107C'),
    ('SOT-563', 'ES6'),
    ('SOT-23-4', 'SOT-23-4'),
    ('SOT-23-4', 'SOT143'),
    ('SOT-23-4', 'TO253'),
    ('SOT-490', 'SOT-490'),
    ('SOT-490', 'SOT523F'),
    ('SOT-490', 'SC89'),
    ('SOT-490', 'EMT3F'),
    ('SOT-89-3', 'SOT-89-3'),
    ('SOT-89-3', 'TO243AA'),
    ('SOT-89-3', 'SC62'),
    ('SOT-89-3', 'MPT3'),
    ('SOT-223-4', 'SOT-223-4'),
    ('SOT-223-4', 'SC73'),
    ('SOT-223-4', 'TO261AA'),
    ('SOT-223-8', 'SOT-223-8'),
    ('SOT-223-8', 'SM-8'),
    ('SOT-23-8', 'SOT-23-8'),
    ('SOT-23-8', 'SOT28'),
    ('TO-92', 'TO-92'),
    ('TO-92', 'SOT54'),
    ('SMA', 'SMA'),
    ('SMA', 'DO-214AC'),
    ('DO-201', 'DO-201'),
    ('DO-214', 'DO-214'),
    ('SMB', 'SMB'),
    ('SMB', 'DO-214AA'),
    ('SMC', 'SMC'),
    ('SMC', 'DO-214AB'),
    ('GF1', 'GF1'),
    ('GF1', 'DO-214BA'),
    ('DO-41', 'DO-41'),
    ('DO-41', 'DO-204AL'),
    ('DO-35', 'DO-35'),
    ('DO-35', 'DO-204AH'),
    ('DO-15', 'DO-15'),
    ('DO-15', 'DO-204AC'),
    ('DO-15', 'SC-39'),
    ('SOD-68', 'SOD-68'),
    ('SOD-68', 'DO-34'),
    ('SOD-68', 'MSD'),
    ('MiniMELF', 'MiniMELF'),
    ('MiniMELF', 'DO-213AA'),
    ('MiniMELF', 'SOD-80'),
    ('MiniMELF', 'LL-34'),
    ('MELF', 'MELF'),
    ('MELF', 'DO-213AB'),
    ('MELF', 'SOD-106'),
    ('MELF', 'LL-41'),
    ('SOD-123', 'SOD-123'),
    ('SOD-323', 'SOD-323'),
    ('SOD-523', 'SOD-523'),
    ('SOD-723', 'SOD-723'),
    ('SOD-923', 'SOD-923'),
    ('DPAK', 'DPAK'),
    ('DPAK', 'TO-252'),
    ('D2PAK', 'D2PAK'),
    ('D2PAK', 'TO-263'),
    ('D2PAK', 'DDPAK'),
    ('D2PAK', 'SOT404'),
    ('IPAK', 'IPAK'),
    ('IPAK', 'TO-251'),
    ('I2PAK', 'I2PAK'),
    ('I2PAK', 'TO-262'),
    ('D3PAK', 'D3PAK'),
    ('D3PAK', 'TO-268'),
    ('TO-273', 'TO-273'),
    ('TO-273', 'Super-220'),
    ('TO-274', 'TO-274'),
    ('TO-274', 'Super-247'),
    ('TO-277', 'TO-277'),
    ('TO-277', 'SMPC'),
    ('TO-277', 'SM-7'),
    ('DFN', 'DFN'),
    ('DFN', 'SON'),
    ('WCSP', 'WCSP'),
    ('WCSP', 'DSBGA'),
    ('MSOP', 'MSOP'),
    ('MSOP', 'VSSOP'),
    ('MSOP', 'MO-187AA'),
    ('SSOP', 'SSOP'),
    ('SSOP', 'MO-137'),
    ('TSSOP', 'TSSOP'),
    ('TSSOP', 'MO-153'),
    ('HTSSOP', 'HTSSOP'),
    ('HTSSOP', 'HSSOP'),
    ('HSOP', 'HSOP'),
    ('HTQFP', 'HTQFP'),
    ('HVQFP', 'HVQFP'),
    ('HLQFP', 'HLQFP'),
    ('HQFP', 'HQFP'),
    ('LQFP', 'LQFP'),
    ('TQFP', 'TQFP'),
    ('VQFP', 'VQFP'),
    ('VQFN', 'VQFN'),
    ('VFQFN', 'VFQFN'),
    ('MQFP', 'MQFP'),
    ('CDIP', 'CDIP'),
    ('PDIP', 'PDIP'),
    ('SDIP', 'SDIP'),
    ('SOIC', 'SOIC'),
    ('VSSR', 'VSSR'),
    ('VTSR', 'VTSR'),
    ('TO-3', 'TO-3'),
    ('TO-5', 'TO-5'),
    ('TO-8', 'TO-8'),
    ('TO-18', 'TO-18'),
    ('TO-39', 'TO-39'),
    ('TO-66', 'TO-66'),
    ('TO-126', 'TO-126'),
    ('TO-202', 'TO-202'),
    ('TO-220', 'TO-220'),
    ('TO-247', 'TO-247'),
    ('SIP', 'SIP'),
    ('SIP', 'SIL'),
    ('DIP', 'DIP'),
    ('DIP', 'DIL'),
    ('FlatPack', 'FlatPack'),
    ('SO', 'SO'),
    ('SOP', 'SOP'),
    ('HTSOP', 'HTSOP'),
    ('TSOP', 'TSOP'),
    ('ZIP', 'ZIP'),
    ('LCC', 'LCC'),
    ('QIP', 'QIP'),
    ('QIL', 'QIL'),
    ('PLCC', 'PLCC'),
    ('QFN', 'QFN'),
    ('QFP', 'QFP'),
    ('QUIP', 'QUIP'),
    ('QUIL', 'QUIL'),
    ('BGA', 'BGA'),
    ('eWLB', 'eWLB'),
    ('LGA', 'LGA'),
    ('PGA', 'PGA'),
    ('COB', 'COB'),
    ('COF', 'COF'),
    ('COG', 'COG'),
    ('CSP', 'CSP'),
    ('FlipChip', 'FlipChip'),
    ('PoP', 'PoP'),
    ('QP', 'QP'),
    ('UICC', 'UICC'),
    ('WL-CSP', 'WL-CSP'),
    ('WLP', 'WLP'),
    ('01005', '01005'),
    ('0201', '0201'),
    ('0402', '0402'),
    ('0603', '0603'),
    ('0805', '0805'),
    ('1206', '1206'),
    ('1210', '1210'),
    ('1806', '1806'),
    ('1812', '1812'),
    ('2010', '2010'),
    ('2512', '2512'),
    ('2920', '2920')
) AS seeded_aliases(short_name, alias)
JOIN packages ON packages.short_name = seeded_aliases.short_name
ON CONFLICT (alias_key) DO NOTHING;
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
