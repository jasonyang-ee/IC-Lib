import pool from '../config/database.js';

export const getAllComponents = async (req, res, next) => {
  try {
    const { category, search } = req.query;
    
    let query = `
      SELECT c.*, cat.name as category_name, m.name as manufacturer_name
      FROM components c
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND cat.id = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (search) {
      query += ` AND (c.part_number ILIKE $${paramCount} OR c.description ILIKE $${paramCount} OR c.manufacturer_pn ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ' ORDER BY c.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getComponentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT c.*, cat.name as category_name, m.name as manufacturer_name, m.website as manufacturer_website
      FROM components c
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const createComponent = async (req, res, next) => {
  try {
    const {
      category_id,
      part_number,
      manufacturer_id,
      manufacturer_pn,
      description,
      datasheet_url,
      footprint_path,
      symbol_path,
      pad_path,
      specifications
    } = req.body;

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get category table name
      const categoryResult = await client.query(
        'SELECT table_name FROM component_categories WHERE id = $1',
        [category_id]
      );

      if (categoryResult.rows.length === 0) {
        throw new Error('Invalid category_id');
      }

      const categoryTable = categoryResult.rows[0].table_name;

      // Insert into category-specific table (triggers will sync to master components table)
      const insertQuery = `
        INSERT INTO ${categoryTable} (
          category_id, part_number, manufacturer_id, manufacturer_pn,
          description, datasheet_url, footprint_path, symbol_path, pad_path
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const componentResult = await client.query(insertQuery, [
        category_id, part_number, manufacturer_id, manufacturer_pn,
        description, datasheet_url, footprint_path, symbol_path, pad_path
      ]);

      const component = componentResult.rows[0];

      // Insert specifications if provided
      if (specifications && Array.isArray(specifications)) {
        for (const spec of specifications) {
          await client.query(`
            INSERT INTO component_specifications (component_id, spec_name, spec_value, unit)
            VALUES ($1, $2, $3, $4)
          `, [component.id, spec.name || spec.key, spec.value, spec.unit]);
        }
      }

      await client.query('COMMIT');
      
      // Fetch the complete component with joined data
      const fullComponent = await client.query(`
        SELECT c.*, cat.name as category_name, m.name as manufacturer_name
        FROM components c
        LEFT JOIN component_categories cat ON c.category_id = cat.id
        LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
        WHERE c.id = $1
      `, [component.id]);

      res.status(201).json(fullComponent.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating component:', error);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in createComponent:', error);
    next(error);
  }
};

export const updateComponent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      category_id,
      part_number,
      manufacturer_id,
      manufacturer_pn,
      description,
      datasheet_url,
      footprint_path,
      symbol_path,
      pad_path
    } = req.body;

    const result = await pool.query(`
      UPDATE components SET
        category_id = COALESCE($1, category_id),
        part_number = COALESCE($2, part_number),
        manufacturer_id = COALESCE($3, manufacturer_id),
        manufacturer_pn = COALESCE($4, manufacturer_pn),
        description = COALESCE($5, description),
        datasheet_url = COALESCE($6, datasheet_url),
        footprint_path = COALESCE($7, footprint_path),
        symbol_path = COALESCE($8, symbol_path),
        pad_path = COALESCE($9, pad_path),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [
      category_id, part_number, manufacturer_id, manufacturer_pn,
      description, datasheet_url, footprint_path, symbol_path, pad_path, id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const deleteComponent = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM components WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.json({ message: 'Component deleted successfully' });
  } catch (error) {
    console.error('Error deleting component:', error);
    next(error);
  }
};

export const getComponentSpecifications = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM component_specifications WHERE component_id = $1 ORDER BY spec_name',
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching component specifications:', error);
    next(error);
  }
};

export const updateComponentSpecifications = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { specifications } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing specifications
      await client.query('DELETE FROM component_specifications WHERE component_id = $1', [id]);

      // Insert new specifications
      if (specifications && Array.isArray(specifications)) {
        for (const spec of specifications) {
          await client.query(`
            INSERT INTO component_specifications (component_id, spec_name, spec_value, unit)
            VALUES ($1, $2, $3, $4)
          `, [id, spec.name || spec.key, spec.value, spec.unit]);
        }
      }

      await client.query('COMMIT');

      const result = await client.query(
        'SELECT * FROM component_specifications WHERE component_id = $1',
        [id]
      );

      res.json(result.rows);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating component specifications:', error);
    next(error);
  }
};

export const getDistributorInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT di.*, d.name as distributor_name
      FROM distributor_info di
      JOIN distributors d ON di.distributor_id = d.id
      WHERE di.component_id = $1
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const updateDistributorInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { distributors } = req.body;

    if (!distributors || !Array.isArray(distributors)) {
      return res.status(400).json({ error: 'Invalid distributors data' });
    }

    // Update each distributor's part number
    const updates = distributors.map(async (dist) => {
      if (dist.id) {
        await pool.query(`
          UPDATE distributor_info 
          SET distributor_part_number = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE component_id = $2 AND id = $3
        `, [dist.distributor_part_number || null, id, dist.id]);
      }
    });

    await Promise.all(updates);

    // Return updated distributor info
    const result = await pool.query(`
      SELECT di.*, d.name as distributor_name
      FROM distributor_info di
      JOIN distributors d ON di.distributor_id = d.id
      WHERE di.component_id = $1
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};
