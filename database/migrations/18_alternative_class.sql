-- Migration 18: nullable alternative criticality class (SPEC V59, C4, F7.T1)
-- Target release: next after 1.10.0 (see CHANGELOG.md Unreleased)
-- Adds the library-default class on components and the per-BOM-line override on
-- project_components, then exposes the component default on the six
-- component-facing external views. eco_orders_full is deliberately untouched.
--
-- init-schema.sql declares only the two table columns; this migration is the
-- SOLE owner of alt_class in the views, on both the fresh and the upgrade path.
-- That is deliberate. Migrations always run after init-schema (SPEC V4), and
-- splitting ownership breaks twice over: init-schema's alternative_parts would
-- be overwritten by migration 1, which recreates that view without alt_class;
-- and a fresh install's `c.*`-expanded components_full would place alt_class
-- mid-list (before the join columns) while an upgraded one places it last,
-- leaving the two paths with different external column orders.

-- 1. Columns. Nullable with no default: existing rows stay NULL ("Unrated").
ALTER TABLE components
  ADD COLUMN IF NOT EXISTS alt_class CHAR(1);

ALTER TABLE project_components
  ADD COLUMN IF NOT EXISTS alt_class CHAR(1);

-- 2. Domain CHECKs. NULL passes (NULL IN (...) is NULL, not false), so no
--    backfill is needed. Postgres has no ADD CONSTRAINT IF NOT EXISTS for
--    CHECK, so guard on pg_constraint (same pattern as migration 16).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_components_alt_class'
  ) THEN
    ALTER TABLE components
      ADD CONSTRAINT check_components_alt_class
      CHECK (alt_class IN ('A', 'B', 'C'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_project_components_alt_class'
  ) THEN
    ALTER TABLE project_components
      ADD CONSTRAINT check_project_components_alt_class
      CHECK (alt_class IN ('A', 'B', 'C'));
  END IF;
END $$;

-- 3. components_full needs a dynamic rebuild, unlike the other five views.
--    It is defined as `SELECT c.*, <6 join/aggregate columns>`, and Postgres
--    expands `*` once at creation time and freezes the resulting column list.
--    Migration 13 added components.last_specs_refresh_at without replacing the
--    view, so an upgraded database's stored components_full does NOT carry that
--    column while a freshly initialized one does (init-schema declares it
--    before updated_at). The two paths therefore differ in which columns the
--    view exposes and in what order, so no hard-coded projection is correct on
--    both. CREATE OR REPLACE VIEW also refuses to insert a column mid-list
--    (SPEC R14), which is exactly what re-expanding `c.*` would now do.
--    So: read the view's CURRENT column list, re-emit those columns in their
--    existing ordinals, and append alt_class last.
DO $$
DECLARE
  v_existing_columns TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'components_full'
      AND column_name = 'alt_class'
  ) THEN
    RETURN;
  END IF;

  -- Every components_full column that also exists on components, in the
  -- view's own ordinal order. This is the frozen `c.*` prefix. alt_class
  -- cannot appear here: it was just added to the table, not to the view.
  SELECT string_agg(format('c.%I', view_column.column_name), ', '
                    ORDER BY view_column.ordinal_position)
    INTO v_existing_columns
  FROM information_schema.columns view_column
  WHERE view_column.table_schema = 'public'
    AND view_column.table_name = 'components_full'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns table_column
      WHERE table_column.table_schema = 'public'
        AND table_column.table_name = 'components'
        AND table_column.column_name = view_column.column_name
    );

  IF v_existing_columns IS NULL THEN
    RAISE EXCEPTION
      'components_full is missing or exposes no components columns; refusing to rebuild it';
  END IF;

  EXECUTE format($rebuild$
    CREATE OR REPLACE VIEW components_full AS
    SELECT
        %s,
        cat.name as category_name,
        cat.prefix as category_prefix,
        m.name as manufacturer_name,
        m.website as manufacturer_website,
        COUNT(DISTINCT di.id) as distributor_count,
        COALESCE(inv.total_quantity, 0) as inventory_quantity,
        c.alt_class
    FROM components c
    LEFT JOIN component_categories cat ON c.category_id = cat.id
    LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
    LEFT JOIN distributor_info di ON c.id = di.component_id
    LEFT JOIN (
        SELECT component_id, SUM(quantity) as total_quantity
        FROM inventory
        GROUP BY component_id
    ) inv ON c.id = inv.component_id
    GROUP BY c.id, cat.name, cat.prefix, m.name, m.website, inv.total_quantity
  $rebuild$, v_existing_columns);
END $$;

-- 4. The remaining five component-facing views have explicit projections that
--    are identical on the fresh and upgraded paths, so appending one column at
--    the end of the list is all CREATE OR REPLACE VIEW needs.

CREATE OR REPLACE VIEW component_specifications_view AS
SELECT
    csv.id,
    csv.component_id,
    c.part_number,
    c.category_id,
    cat.name as category_name,
    cs.spec_name,
    cs.unit,
    csv.spec_value,
    cs.is_required,
    cs.display_order,
    csv.updated_at,
    c.alt_class
FROM component_specification_values csv
JOIN category_specifications cs ON csv.category_spec_id = cs.id
JOIN components c ON csv.component_id = c.id
JOIN component_categories cat ON c.category_id = cat.id
ORDER BY csv.component_id, cs.display_order;

CREATE OR REPLACE VIEW production_parts AS
SELECT
    c.part_number,
    cat.name AS category_name,
    get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3, c.sub_category4) as part_type,
	c.value,
	c.package_size,
	c.manufacturer_pn,
    m.name AS manufacturer_name,
	c.schematic,
	c.pcb_footprint,
	c.description,
	c.alt_class
FROM components c
LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
LEFT JOIN component_categories cat ON c.category_id = cat.id
WHERE c.approval_status = 'production';

CREATE OR REPLACE VIEW prototype_parts AS
SELECT
    c.part_number,
    cat.name AS category_name,
    get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3, c.sub_category4) as part_type,
	c.value,
	c.package_size,
	c.manufacturer_pn,
    m.name AS manufacturer_name,
	c.schematic,
	c.pcb_footprint,
	c.description,
	c.alt_class
FROM components c
LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
LEFT JOIN component_categories cat ON c.category_id = cat.id
WHERE c.approval_status = 'prototype' OR c.approval_status = 'new' OR c.approval_status = 'reviewing';

CREATE OR REPLACE VIEW archived_parts AS
SELECT
    c.part_number,
    cat.name AS category_name,
    get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3, c.sub_category4) as part_type,
	c.value,
	c.package_size,
	c.manufacturer_pn,
    m.name AS manufacturer_name,
	c.schematic,
	c.pcb_footprint,
	c.description,
	c.alt_class
FROM components c
LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
LEFT JOIN component_categories cat ON c.category_id = cat.id
WHERE c.approval_status = 'archived';

-- alt_class here is the PARENT component's library default: alternatives carry
-- no class of their own.
CREATE OR REPLACE VIEW alternative_parts AS
SELECT
    c.part_number,
    ca.manufacturer_pn AS manufacturer_pn,
    m.name AS manufacturer_name,
    c.alt_class
FROM components_alternative ca
LEFT JOIN components c ON ca.component_id = c.id
LEFT JOIN manufacturers m ON ca.manufacturer_id = m.id;
