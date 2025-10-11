import pool from '../config/database.js';

export const getAllInventory = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        i.*,
        c.part_number,
        c.manufacturer_pn,
        c.description,
        cat.name as category_name,
        m.name as manufacturer_name
      FROM inventory i
      JOIN components c ON i.component_id = c.id
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      ORDER BY i.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getInventoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        i.*,
        c.part_number,
        c.manufacturer_pn,
        c.description,
        cat.name as category_name,
        m.name as manufacturer_name
      FROM inventory i
      JOIN components c ON i.component_id = c.id
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      WHERE i.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const getInventoryByComponent = async (req, res, next) => {
  try {
    const { componentId } = req.params;

    const result = await pool.query(
      'SELECT * FROM inventory WHERE component_id = $1',
      [componentId]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const createInventory = async (req, res, next) => {
  try {
    const {
      component_id,
      location,
      quantity,
      minimum_quantity,
      last_counted,
      notes
    } = req.body;

    const result = await pool.query(`
      INSERT INTO inventory (
        component_id, location, quantity, minimum_quantity,
        last_counted, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [component_id, location, quantity, minimum_quantity, last_counted, notes]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const updateInventory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      location,
      quantity,
      minimum_quantity,
      last_counted,
      notes
    } = req.body;

    // First, get the old values and component info for activity logging
    const oldData = await pool.query(`
      SELECT 
        i.*,
        c.part_number,
        c.description,
        cat.name as category_name
      FROM inventory i
      JOIN components c ON i.component_id = c.id
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      WHERE i.id = $1
    `, [id]);

    if (oldData.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const oldItem = oldData.rows[0];

    // Update the inventory
    const result = await pool.query(`
      UPDATE inventory SET
        location = COALESCE($1, location),
        quantity = COALESCE($2, quantity),
        minimum_quantity = COALESCE($3, minimum_quantity),
        last_counted = COALESCE($4, last_counted),
        notes = COALESCE($5, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [location, quantity, minimum_quantity, last_counted, notes, id]);

    const updatedItem = result.rows[0];

    // Log activity based on what changed
    if (location !== undefined && location !== oldItem.location) {
      await pool.query(`
        INSERT INTO activity_log (component_id, part_number, description, category_name, activity_type, change_details)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        oldItem.component_id,
        oldItem.part_number,
        oldItem.description,
        oldItem.category_name,
        'location_updated',
        JSON.stringify({ old_location: oldItem.location, new_location: location })
      ]);
    }

    if (quantity !== undefined && quantity !== oldItem.quantity) {
      // Determine if this is a quantity set or consume operation
      const activityType = quantity < oldItem.quantity ? 'inventory_consumed' : 'inventory_updated';
      await pool.query(`
        INSERT INTO activity_log (component_id, part_number, description, category_name, activity_type, change_details)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        oldItem.component_id,
        oldItem.part_number,
        oldItem.description,
        oldItem.category_name,
        activityType,
        JSON.stringify({ old_quantity: oldItem.quantity, new_quantity: quantity, change: quantity - oldItem.quantity })
      ]);
    }

    res.json(updatedItem);
  } catch (error) {
    next(error);
  }
};

export const deleteInventory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM inventory WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getLowStockItems = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        i.*,
        c.part_number,
        c.description,
        cat.name as category_name
      FROM inventory i
      JOIN components c ON i.component_id = c.id
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      WHERE i.quantity <= i.minimum_quantity AND i.minimum_quantity > 0
      ORDER BY (i.quantity - i.minimum_quantity)
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const searchByBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    // Search for components matching the barcode in distributor SKUs
    const result = await pool.query(`
      SELECT DISTINCT
        i.*,
        c.part_number,
        c.manufacturer_pn,
        c.description,
        cat.name as category_name,
        m.name as manufacturer_name,
        d.name as distributor_name,
        di.sku
      FROM components c
      LEFT JOIN inventory i ON c.id = i.component_id
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      LEFT JOIN distributor_info di ON c.id = di.component_id
      LEFT JOIN distributors d ON di.distributor_id = d.id
      WHERE di.sku = $1 
         OR c.manufacturer_pn = $1
         OR c.part_number = $1
      ORDER BY c.part_number
    `, [barcode]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No component found with this barcode/SKU' });
    }

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};
