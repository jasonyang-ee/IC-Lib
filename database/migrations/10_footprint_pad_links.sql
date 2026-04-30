-- Add persistent footprint-pad link history for OrCAD file pairing.
CREATE TABLE IF NOT EXISTS footprint_pad_links (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    footprint_cad_file_id UUID NOT NULL REFERENCES cad_files(id) ON DELETE CASCADE,
    pad_cad_file_id UUID NOT NULL REFERENCES cad_files(id) ON DELETE CASCADE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_footprint_pad_link UNIQUE (footprint_cad_file_id, pad_cad_file_id)
);

CREATE INDEX IF NOT EXISTS idx_footprint_pad_links_footprint
    ON footprint_pad_links(footprint_cad_file_id);

CREATE INDEX IF NOT EXISTS idx_footprint_pad_links_pad
    ON footprint_pad_links(pad_cad_file_id);