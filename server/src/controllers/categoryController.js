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

    // Get the category to find its prefix and leading_zeros (id is now UUID)
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

/**
 * Update part numbers for all components in a category
 * Used when admin changes the category prefix
 */
export const updateCategoryPartNumbers = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { new_prefix } = req.body;

    if (!new_prefix) {
      return res.status(400).json({ error: 'new_prefix is required' });
    }

    await client.query('BEGIN');

    // Get the category's current prefix and leading_zeros
    const categoryResult = await client.query(
      'SELECT prefix, leading_zeros FROM component_categories WHERE id = $1',
      [id],
    );

    if (categoryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Category not found' });
    }

    const { prefix: oldPrefix, leading_zeros = 5 } = categoryResult.rows[0];

    // Get all components in this category
    const componentsResult = await client.query(
      'SELECT id, part_number FROM components WHERE category_id = $1 ORDER BY part_number',
      [id],
    );

    const updatedComponents = [];

    for (const comp of componentsResult.rows) {
      // Extract the numeric part from the old part number
      const match = comp.part_number.match(new RegExp(`^${oldPrefix}-(\\d+)$`));
      if (match) {
        const numericPart = match[1];
        const paddedNumber = numericPart.padStart(leading_zeros, '0');
        const newPartNumber = `${new_prefix}-${paddedNumber}`;

        // Update the component's part number
        await client.query(
          'UPDATE components SET part_number = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newPartNumber, comp.id],
        );

        // Update alternative parts references
        await client.query(
          'UPDATE components_alternative SET part_number = $1 WHERE part_number = $2',
          [newPartNumber, comp.part_number],
        );

        updatedComponents.push({
          id: comp.id,
          old_part_number: comp.part_number,
          new_part_number: newPartNumber,
        });
      }
    }

    // Update the category's prefix
    await client.query(
      'UPDATE component_categories SET prefix = $1 WHERE id = $2',
      [new_prefix, id],
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Updated ${updatedComponents.length} component part numbers`,
      old_prefix: oldPrefix,
      new_prefix: new_prefix,
      updated_count: updatedComponents.length,
      updated_components: updatedComponents,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[CategoryController]\x1b[0m Error updating category part numbers: ${error.message}`);
    next(error);
  } finally {
    client.release();
  }
};
