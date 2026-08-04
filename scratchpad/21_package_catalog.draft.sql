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

CREATE INDEX IF NOT EXISTS idx_package_aliases_package_id
  ON package_aliases(package_id);
