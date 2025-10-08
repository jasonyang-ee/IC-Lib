import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Get all distributors
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM distributors ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;
