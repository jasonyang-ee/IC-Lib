-- 1.9.10
-- Route staged shared file-library renames through a dedicated approval tag.

UPDATE eco_approval_stages
SET pipeline_types = ARRAY(
    SELECT dedup.pipeline_type
    FROM (
        SELECT DISTINCT ON (expanded.pipeline_type)
            expanded.pipeline_type,
            expanded.ord
        FROM unnest(eco_approval_stages.pipeline_types || ARRAY['shared_file_rename']::text[]) WITH ORDINALITY AS expanded(pipeline_type, ord)
        ORDER BY expanded.pipeline_type, expanded.ord
    ) AS dedup
    ORDER BY dedup.ord
)
WHERE pipeline_types @> ARRAY['filename']::text[]
  AND NOT pipeline_types @> ARRAY['shared_file_rename']::text[];

UPDATE eco_approval_stages
SET pipeline_types = ARRAY(
    SELECT dedup.pipeline_type
    FROM (
        SELECT DISTINCT ON (expanded.pipeline_type)
            expanded.pipeline_type,
            expanded.ord
        FROM unnest(eco_approval_stages.pipeline_types || ARRAY['alt_parts']::text[]) WITH ORDINALITY AS expanded(pipeline_type, ord)
        ORDER BY expanded.pipeline_type, expanded.ord
    ) AS dedup
    ORDER BY dedup.ord
)
WHERE pipeline_types @> ARRAY['proto_status_change', 'prod_status_change', 'spec', 'filename', 'distributor']::text[]
  AND NOT pipeline_types @> ARRAY['alt_parts']::text[];

ALTER TABLE eco_approval_stages
ALTER COLUMN pipeline_types
SET DEFAULT '{proto_status_change,prod_status_change,spec,filename,shared_file_rename,distributor,alt_parts}';

UPDATE eco_orders
SET
    pipeline_types = ARRAY(
        SELECT dedup.pipeline_type
        FROM (
            SELECT DISTINCT ON (expanded.pipeline_type)
                expanded.pipeline_type,
                expanded.ord
            FROM unnest(array_remove(eco_orders.pipeline_types, 'filename') || ARRAY['shared_file_rename']::text[]) WITH ORDINALITY AS expanded(pipeline_type, ord)
            ORDER BY expanded.pipeline_type, expanded.ord
        ) AS dedup
        ORDER BY dedup.ord
    ),
    pipeline_type = 'shared_file_rename'
WHERE EXISTS (
    SELECT 1
    FROM eco_file_rename_files
    WHERE eco_id = eco_orders.id
);

DO $$
BEGIN
  ALTER TABLE eco_orders DROP CONSTRAINT IF EXISTS check_pipeline_type;
  ALTER TABLE eco_orders ADD CONSTRAINT check_pipeline_type CHECK (
    pipeline_type IN (
      'proto_status_change',
      'prod_status_change',
      'spec',
      'filename',
      'shared_file_rename',
      'distributor',
      'alt_parts'
    )
  );
END $$;
