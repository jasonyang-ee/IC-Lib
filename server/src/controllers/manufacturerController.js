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
