-- Migration 13: dedicated oldest-first refresh cursors for vendor stock/spec update queues

ALTER TABLE distributor_info
  ADD COLUMN IF NOT EXISTS last_vendor_sync_at TIMESTAMP;

UPDATE distributor_info
SET last_vendor_sync_at = COALESCE(last_vendor_sync_at, updated_at)
WHERE last_vendor_sync_at IS NULL;

ALTER TABLE components
  ADD COLUMN IF NOT EXISTS last_specs_refresh_at TIMESTAMP;

WITH latest_spec_refresh AS (
  SELECT
    component_id,
    MAX(updated_at) AS last_specs_refresh_at
  FROM component_specification_values
  GROUP BY component_id
)
UPDATE components c
SET last_specs_refresh_at = COALESCE(
  c.last_specs_refresh_at,
  latest_spec_refresh.last_specs_refresh_at,
  c.updated_at
)
FROM latest_spec_refresh
WHERE latest_spec_refresh.component_id = c.id
  AND c.last_specs_refresh_at IS NULL;

UPDATE components
SET last_specs_refresh_at = COALESCE(last_specs_refresh_at, updated_at)
WHERE last_specs_refresh_at IS NULL;