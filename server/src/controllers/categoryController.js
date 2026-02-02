import pool from '../config/database.js';

export const getAllCategories = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM component_categories ORDER BY display_order, name',
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM component_categories WHERE id = $1',
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, description, table_name } = req.body;

    const result = await pool.query(`
      INSERT INTO component_categories (name, description, table_name)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, description, table_name]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const result = await pool.query(`
      UPDATE component_categories SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [name, description, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM component_categories WHERE id = $1 RETURNING *',
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getComponentsByCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT c.*, m.name as manufacturer_name
      FROM components c
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      WHERE c.category_id = $1
      ORDER BY c.part_number
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Get next available part number for a category
 * Checks ALL categories that share the same prefix to avoid duplicates
 */
export const getNextPartNumber = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get the category to find its prefix and leading_zeros
    const categoryResult = await pool.query(
      'SELECT prefix, leading_zeros FROM component_categories WHERE id = $1',
      [id],
    );

    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const { prefix, leading_zeros = 5 } = categoryResult.rows[0];

    // Find the maximum number used across ALL components with this prefix
    // This ensures unique part numbers even when multiple categories share a prefix
    const maxResult = await pool.query(`
      SELECT MAX(
        CAST(
          SUBSTRING(part_number FROM '^${prefix}-(\\d+)$')
          AS INTEGER
        )
      ) as max_number
      FROM components
      WHERE part_number ~ '^${prefix}-\\d+$'
    `);

    const maxNumber = maxResult.rows[0].max_number || 0;
    const nextNumber = maxNumber + 1;
    const paddedNumber = String(nextNumber).padStart(leading_zeros, '0');
    const nextPartNumber = `${prefix}-${paddedNumber}`;

    res.json({
      prefix,
      leading_zeros,
      next_number: nextNumber,
      next_part_number: nextPartNumber,
    });
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[CategoryController]\x1b[0m Error getting next part number: ${error.message}`);
    next(error);
  }
};
