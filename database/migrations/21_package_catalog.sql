-- Migration 21: add canonical package catalog (SPEC V61, V62)
-- Target release: next after 1.10.0 (see CHANGELOG.md Unreleased)

CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  short_name TEXT NOT NULL UNIQUE,
  family TEXT,
  mount TEXT,
  count_policy TEXT NOT NULL CHECK (count_policy IN ('chip', 'embedded', 'none', 'append')),
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER
);

CREATE TABLE IF NOT EXISTS package_aliases (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_key TEXT GENERATED ALWAYS AS (
    lower(regexp_replace(alias, '[^A-Za-z0-9]', '', 'g'))
  ) STORED,
  UNIQUE (alias_key)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'packages'::regclass
      AND conname = 'packages_count_policy_check'
  ) THEN
    ALTER TABLE packages
      ADD CONSTRAINT packages_count_policy_check
      CHECK (count_policy IN ('chip', 'embedded', 'none', 'append'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'packages'::regclass
      AND conname = 'packages_short_name_key'
  ) THEN
    ALTER TABLE packages
      ADD CONSTRAINT packages_short_name_key UNIQUE (short_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'package_aliases'::regclass
      AND conname = 'package_aliases_alias_key_key'
  ) THEN
    ALTER TABLE package_aliases
      ADD CONSTRAINT package_aliases_alias_key_key UNIQUE (alias_key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_package_aliases_package_id
  ON package_aliases(package_id);
