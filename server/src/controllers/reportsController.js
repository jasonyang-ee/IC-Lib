import pool from '../config/database.js';

export const getComponentSummary = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        cat.name as category,
        COUNT(c.id) as total_components,
        COUNT(DISTINCT CASE WHEN fs.footprint_path IS NOT NULL AND fs.footprint_path != '' THEN c.id END) as with_footprint,
        COUNT(DISTINCT CASE WHEN fs.symbol_path IS NOT NULL AND fs.symbol_path != '' THEN c.id END) as with_symbol
      FROM component_categories cat
      LEFT JOIN components c ON cat.id = c.category_id
      LEFT JOIN footprint_sources fs ON c.id = fs.component_id
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
      SELECT 
        cat.name as category,
        0 as total_value,
        SUM(i.quantity) as total_quantity,
        COUNT(DISTINCT i.component_id) as unique_components
      FROM inventory i
      JOIN components c ON i.component_id = c.id
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      GROUP BY cat.name
      ORDER BY total_quantity DESC NULLS LAST
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getMissingFootprints = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.part_number,
        c.manufacturer_pn as manufacturer_part_number,
        c.description,
        cat.name as category_name,
        m.name as manufacturer_name
      FROM components c
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      LEFT JOIN footprint_sources fs ON c.id = fs.component_id
      WHERE fs.id IS NULL OR fs.footprint_path IS NULL OR fs.footprint_path = ''
      ORDER BY cat.name, c.part_number
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
        m.name as manufacturer,
        COUNT(c.id) as component_count,
        COUNT(DISTINCT cat.id) as category_count
      FROM manufacturers m
      LEFT JOIN components c ON m.id = c.manufacturer_id
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      GROUP BY m.name
      ORDER BY component_count DESC
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
        cat.name as category,
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

export const customReport = async (req, res, next) => {
  try {
    const { query, params } = req.body;

    // Basic security: only allow SELECT statements
    if (!query.trim().toUpperCase().startsWith('SELECT')) {
      return res.status(400).json({ error: 'Only SELECT queries are allowed' });
    }

    const result = await pool.query(query, params || []);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};
