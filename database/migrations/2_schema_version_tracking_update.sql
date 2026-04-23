-- Consolidate legacy schema_version metadata into schema_migrations.
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    sequence_number INTEGER,
    description TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS sequence_number INTEGER;
ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE schema_migrations DROP COLUMN IF EXISTS version_tag;

DELETE FROM schema_migrations versioned
USING schema_migrations numeric
WHERE versioned.filename ~ '^v[^_]+_[0-9]+_.+\.sql$'
  AND numeric.filename = regexp_replace(versioned.filename, '^v[^_]+_', '');

UPDATE schema_migrations
SET filename = regexp_replace(filename, '^v[^_]+_', '')
WHERE filename ~ '^v[^_]+_[0-9]+_.+\.sql$';

WITH parsed_migrations AS (
    SELECT
        id,
        regexp_match(filename, '^([0-9]+)_(.+)\.sql$') AS parts
    FROM schema_migrations
    WHERE filename ~ '^[0-9]+_.+\.sql$'
)
UPDATE schema_migrations sm
SET sequence_number = parsed_migrations.parts[1]::INTEGER,
    description = replace(parsed_migrations.parts[2], '_', ' ')
FROM parsed_migrations
WHERE sm.id = parsed_migrations.id
  AND (sm.sequence_number IS NULL OR sm.description IS NULL);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'schema_version'
  ) THEN
    INSERT INTO schema_migrations (filename, sequence_number, description, executed_at)
    SELECT
      CONCAT('0_schema_version_', replace(version, '.', '_'), '.sql'),
      0,
      COALESCE(description, 'Historical schema version marker'),
      COALESCE(applied_at, CURRENT_TIMESTAMP)
    FROM schema_version
    ON CONFLICT (filename) DO NOTHING;

    DROP TABLE schema_version;
  END IF;
END $$;