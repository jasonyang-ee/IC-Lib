import pool from '../config/database.js';

export const getComponentSummary = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(cat.name, 'Uncategorized') as category,
        COUNT(c.id) as total_components,
        COUNT(c.id) FILTER (WHERE NULLIF(BTRIM(c.pcb_footprint), '') IS NOT NULL) as with_footprint,
        COUNT(c.id) FILTER (WHERE NULLIF(BTRIM(c.schematic), '') IS NOT NULL) as with_symbol,
        COUNT(c.id) FILTER (WHERE NULLIF(BTRIM(c.step_model), '') IS NOT NULL) as with_3d_model,
        COUNT(c.id) FILTER (WHERE NULLIF(BTRIM(c.pad_file), '') IS NOT NULL) as with_pad,
        COUNT(c.id) FILTER (WHERE NULLIF(BTRIM(c.pspice), '') IS NOT NULL) as with_pspice
      FROM component_categories cat
      LEFT JOIN components c ON cat.id = c.category_id
      GROUP BY cat.name
      ORDER BY cat.name
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getCategoryDistribution = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        cat.name as category,
        COUNT(c.id) as count,
        ROUND(COUNT(c.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM components), 0), 2) as percentage
      FROM component_categories cat
      LEFT JOIN components c ON cat.id = c.category_id
      GROUP BY cat.name
      ORDER BY count DESC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getInventoryValue = async (req, res, next) => {
  try {
    const result = await pool.query(`
      WITH normalized_price_breaks AS (
        SELECT
          di.component_id,
          COALESCE(
            NULLIF(REGEXP_REPLACE(price_break.value->>'quantity', '[^0-9.\\-]', '', 'g'), '')::numeric,
            1
          ) AS break_quantity,
          NULLIF(REGEXP_REPLACE(price_break.value->>'price', '[^0-9.\\-]', '', 'g'), '')::numeric AS unit_price,
          ROW_NUMBER() OVER (
            PARTITION BY di.id
            ORDER BY COALESCE(
              NULLIF(REGEXP_REPLACE(price_break.value->>'quantity', '[^0-9.\\-]', '', 'g'), '')::numeric,
              1
            ) ASC
          ) AS break_rank
        FROM distributor_info di
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(di.price_breaks) = 'array' THEN di.price_breaks
            ELSE '[]'::jsonb
          END
        ) AS price_break(value)
        WHERE di.component_id IS NOT NULL
      ),
      component_unit_prices AS (
        SELECT
          component_id,
          MIN(unit_price) AS unit_price
        FROM normalized_price_breaks
        WHERE break_rank = 1 AND unit_price IS NOT NULL
        GROUP BY component_id
      )
      SELECT 
        COALESCE(cat.name, 'Uncategorized') as category,
        ROUND(COALESCE(SUM(component_unit_prices.unit_price * COALESCE(i.quantity, 0)), 0), 2) as total_value,
        COALESCE(SUM(i.quantity), 0) as total_quantity,
        COUNT(DISTINCT i.component_id) as unique_components,
        COUNT(DISTINCT CASE WHEN component_unit_prices.unit_price IS NOT NULL THEN i.component_id END) as priced_components,
        COUNT(DISTINCT i.component_id) - COUNT(DISTINCT CASE WHEN component_unit_prices.unit_price IS NOT NULL THEN i.component_id END) as unpriced_components
      FROM inventory i
      JOIN components c ON i.component_id = c.id
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN component_unit_prices ON component_unit_prices.component_id = i.component_id
      GROUP BY cat.name
      ORDER BY total_value DESC NULLS LAST, cat.name
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getMissingFootprints = async (req, res, next) => {
  try {
    const result = await pool.query(`
      WITH footprint_health AS (
        SELECT 
          c.id,
          c.part_number,
          c.manufacturer_pn as manufacturer_part_number,
          c.description,
          COALESCE(cat.name, 'Uncategorized') as category_name,
          COALESCE(m.name, 'Unassigned') as manufacturer_name,
          NULLIF(BTRIM(c.pcb_footprint), '') as assigned_footprints,
          COALESCE((
            SELECT COUNT(*)::int
            FROM component_cad_files ccf
            JOIN cad_files cf ON cf.id = ccf.cad_file_id
            WHERE ccf.component_id = c.id
              AND cf.file_type = 'footprint'
              AND cf.missing = TRUE
          ), 0) as missing_file_count
        FROM components c
        LEFT JOIN component_categories cat ON c.category_id = cat.id
        LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      )
      SELECT 
        id,
        part_number,
        manufacturer_part_number,
        description,
        category_name,
        manufacturer_name,
        assigned_footprints,
        missing_file_count,
        CASE
          WHEN assigned_footprints IS NULL THEN 'Undefined'
          ELSE 'Missing file'
        END as issue_type
      FROM footprint_health
      WHERE assigned_footprints IS NULL OR missing_file_count > 0
      ORDER BY category_name, part_number
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getManufacturerReport = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(NULLIF(BTRIM(m.name), ''), 'Unassigned') as manufacturer,
        COUNT(c.id) as component_count,
        COUNT(DISTINCT c.category_id) as category_count
      FROM components c
      LEFT JOIN manufacturers m ON m.id = c.manufacturer_id
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      GROUP BY COALESCE(NULLIF(BTRIM(m.name), ''), 'Unassigned')
      ORDER BY component_count DESC, manufacturer ASC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getLowStockReport = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.part_number,
        c.description,
        COALESCE(cat.name, 'Uncategorized') as category,
        i.quantity as current_stock,
        i.minimum_quantity as minimum_stock,
        (i.minimum_quantity - i.quantity) as shortage,
        i.location
      FROM inventory i
      JOIN components c ON i.component_id = c.id
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      WHERE i.quantity <= i.minimum_quantity AND i.minimum_quantity > 0
      ORDER BY (i.minimum_quantity - i.quantity) DESC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};
