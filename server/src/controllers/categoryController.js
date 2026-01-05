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
