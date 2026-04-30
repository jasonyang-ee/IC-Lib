-- Migration 12: remove orphan junk CAD sidecar rows left by older tracking rules
DELETE FROM cad_files cf
WHERE LOWER(cf.file_name) ~ '\.(obk|opj|jrl|log|tag)$'
  AND NOT EXISTS (
    SELECT 1
    FROM component_cad_files ccf
    WHERE ccf.cad_file_id = cf.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM eco_cad_files ecf
    WHERE ecf.cad_file_id = cf.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM eco_file_rename_files efrf
    WHERE efrf.cad_file_id = cf.id
  );