import pool from '../config/database.js';

export const getAllComponents = async (req, res, next) => {
  try {
    const { category, search, subcategory } = req.query;
    
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

    if (subcategory) {
      query += ` AND c.subcategory = $${paramCount}`;
      params.push(subcategory);
      paramCount++;
    }

    if (search) {
      query += ` AND (c.part_number ILIKE $${paramCount} OR c.description ILIKE $${paramCount} OR c.manufacturer_part_number ILIKE $${paramCount})`;
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
      manufacturer_part_number,
      description,
      subcategory,
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

      // Insert component
      const componentResult = await client.query(`
        INSERT INTO components (
          category_id, part_number, manufacturer_id, manufacturer_part_number,
          description, subcategory, datasheet_url, footprint_path, symbol_path, pad_path
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        category_id, part_number, manufacturer_id, manufacturer_part_number,
        description, subcategory, datasheet_url, footprint_path, symbol_path, pad_path
      ]);

      const component = componentResult.rows[0];

      // Insert specifications if provided
      if (specifications && Array.isArray(specifications)) {
        for (const spec of specifications) {
          await client.query(`
            INSERT INTO component_specifications (component_id, spec_key, spec_value, spec_unit)
            VALUES ($1, $2, $3, $4)
          `, [component.id, spec.key, spec.value, spec.unit]);
        }
      }

      await client.query('COMMIT');
      res.status(201).json(component);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
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
      manufacturer_part_number,
      description,
      subcategory,
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
        manufacturer_part_number = COALESCE($4, manufacturer_part_number),
        description = COALESCE($5, description),
        subcategory = COALESCE($6, subcategory),
        datasheet_url = COALESCE($7, datasheet_url),
        footprint_path = COALESCE($8, footprint_path),
        symbol_path = COALESCE($9, symbol_path),
        pad_path = COALESCE($10, pad_path),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *
    `, [
      category_id, part_number, manufacturer_id, manufacturer_part_number,
      description, subcategory, datasheet_url, footprint_path, symbol_path, pad_path, id
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
    next(error);
  }
};

export const getComponentSpecifications = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM component_specifications WHERE component_id = $1 ORDER BY spec_key',
      [id]
    );

    res.json(result.rows);
  } catch (error) {
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
            INSERT INTO component_specifications (component_id, spec_key, spec_value, spec_unit)
            VALUES ($1, $2, $3, $4)
          `, [id, spec.key, spec.value, spec.unit]);
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
