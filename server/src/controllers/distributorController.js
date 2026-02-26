import pool from '../config/database.js';

// Get all distributors
export const getAllDistributors = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM distributors ORDER BY name',
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};
