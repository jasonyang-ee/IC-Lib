import pool from '../config/database.js';

export const getAllManufacturers = async (req, res, next) => {
  try {
    const { search } = req.query;
    
    let query = `
      SELECT *
      FROM manufacturers
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR website ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getManufacturerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT *
      FROM manufacturers
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Manufacturer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const createManufacturer = async (req, res, next) => {
  try {
    const { name, website } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Manufacturer name is required' });
    }

    const result = await pool.query(`
      INSERT INTO manufacturers (name, website)
      VALUES ($1, $2)
      RETURNING *
    `, [name, website]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Manufacturer with this name already exists' });
    }
    next(error);
  }
};

export const updateManufacturer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, website } = req.body;

    const result = await pool.query(`
      UPDATE manufacturers SET
        name = COALESCE($1, name),
        website = COALESCE($2, website)
      WHERE id = $3
      RETURNING *
    `, [name, website, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Manufacturer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Manufacturer with this name already exists' });
    }
    next(error);
  }
};

export const deleteManufacturer = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM manufacturers WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Manufacturer not found' });
    }

    res.json({ message: 'Manufacturer deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const renameManufacturer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName) {
      return res.status(400).json({ error: 'New manufacturer name is required' });
    }

    // Check if old manufacturer exists
    const oldManufacturer = await pool.query(
      'SELECT * FROM manufacturers WHERE id = $1',
      [id]
    );

    if (oldManufacturer.rows.length === 0) {
      return res.status(404).json({ error: 'Manufacturer not found' });
    }

    // Check if a manufacturer with the new name already exists
    const existingManufacturer = await pool.query(
      'SELECT * FROM manufacturers WHERE name = $1',
      [newName]
    );

    if (existingManufacturer.rows.length > 0) {
      // Merge: Update all components to use the existing manufacturer
      const targetManufacturerId = existingManufacturer.rows[0].id;
      
      await pool.query(`
        UPDATE components 
        SET manufacturer_id = $1 
        WHERE manufacturer_id = $2
      `, [targetManufacturerId, id]);

      // Delete the old manufacturer
      await pool.query('DELETE FROM manufacturers WHERE id = $1', [id]);

      res.json({ 
        message: `Successfully merged "${oldManufacturer.rows[0].name}" into "${newName}"`,
        manufacturer: existingManufacturer.rows[0]
      });
    } else {
      // Simple rename
      const result = await pool.query(`
        UPDATE manufacturers 
        SET name = $1 
        WHERE id = $2 
        RETURNING *
      `, [newName, id]);

      res.json({ 
        message: `Successfully renamed to "${newName}"`,
        manufacturer: result.rows[0]
      });
    }
  } catch (error) {
    next(error);
  }
};
