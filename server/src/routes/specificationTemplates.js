import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// GET /api/specification-templates?category_id=1
// Get specification templates for a category
router.get('/', async (req, res) => {
  try {
    const { category_id } = req.query;
    
    let query = `
      SELECT 
        id,
        category_id,
        spec_name,
        unit,
        display_order,
        is_required,
        created_at
      FROM specification_templates
    `;
    
    const params = [];
    if (category_id) {
      query += ' WHERE category_id = $1';
      params.push(category_id);
    }
    
    query += ' ORDER BY display_order ASC, spec_name ASC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching specification templates:', error);
    res.status(500).json({ error: 'Failed to fetch specification templates' });
  }
});

// POST /api/specification-templates
// Create a new specification template
router.post('/', async (req, res) => {
  try {
    const { category_id, spec_name, unit, display_order, is_required } = req.body;
    
    if (!category_id || !spec_name) {
      return res.status(400).json({ error: 'category_id and spec_name are required' });
    }
    
    const result = await pool.query(
      `INSERT INTO specification_templates 
       (category_id, spec_name, unit, display_order, is_required)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [category_id, spec_name, unit || null, display_order || 0, is_required || false]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating specification template:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This specification already exists for this category' });
    }
    
    res.status(500).json({ error: 'Failed to create specification template' });
  }
});

// PUT /api/specification-templates/:id
// Update a specification template
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { spec_name, unit, display_order, is_required } = req.body;
    
    const result = await pool.query(
      `UPDATE specification_templates
       SET spec_name = COALESCE($1, spec_name),
           unit = COALESCE($2, unit),
           display_order = COALESCE($3, display_order),
           is_required = COALESCE($4, is_required)
       WHERE id = $5
       RETURNING *`,
      [spec_name, unit, display_order, is_required, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Specification template not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating specification template:', error);
    res.status(500).json({ error: 'Failed to update specification template' });
  }
});

// DELETE /api/specification-templates/:id
// Delete a specification template
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM specification_templates WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Specification template not found' });
    }
    
    res.json({ message: 'Specification template deleted successfully' });
  } catch (error) {
    console.error('Error deleting specification template:', error);
    res.status(500).json({ error: 'Failed to delete specification template' });
  }
});

export default router;
