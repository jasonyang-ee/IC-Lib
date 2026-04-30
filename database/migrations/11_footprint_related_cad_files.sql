-- Migration 11: generalize footprint links to pad and 3D model files
CREATE TABLE IF NOT EXISTS footprint_related_cad_files (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    footprint_cad_file_id UUID NOT NULL REFERENCES cad_files(id) ON DELETE CASCADE,
    related_cad_file_id UUID NOT NULL REFERENCES cad_files(id) ON DELETE CASCADE,
    related_file_type TEXT NOT NULL CHECK (related_file_type IN ('pad', 'model')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_footprint_related_cad_file UNIQUE (footprint_cad_file_id, related_cad_file_id)
);

CREATE INDEX IF NOT EXISTS idx_footprint_related_cad_files_footprint
    ON footprint_related_cad_files(footprint_cad_file_id);

CREATE INDEX IF NOT EXISTS idx_footprint_related_cad_files_related
    ON footprint_related_cad_files(related_cad_file_id);

CREATE INDEX IF NOT EXISTS idx_footprint_related_cad_files_related_type
    ON footprint_related_cad_files(related_file_type);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'footprint_pad_links'
    ) THEN
        INSERT INTO footprint_related_cad_files (
            footprint_cad_file_id,
            related_cad_file_id,
            related_file_type
        )
        SELECT footprint_cad_file_id, pad_cad_file_id, 'pad'
        FROM footprint_pad_links
        ON CONFLICT (footprint_cad_file_id, related_cad_file_id) DO NOTHING;

        DROP TABLE footprint_pad_links;
    END IF;
END $$;