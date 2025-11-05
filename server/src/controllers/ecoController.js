import pool from '../config/database.js';

// Get all ECO orders with details
export const getAllECOs = async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        eo.*,
        u1.username as initiated_by_name,
        u2.username as approved_by_name,
        c.part_number as component_part_number,
        c.description as component_description,
        cc.name as category_name,
        m.name as manufacturer_name
      FROM eco_orders eo
      LEFT JOIN users u1 ON eo.initiated_by = u1.id
      LEFT JOIN users u2 ON eo.approved_by = u2.id
      LEFT JOIN components c ON eo.component_id = c.id
      LEFT JOIN component_categories cc ON c.category_id = cc.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
    `;
    
    const params = [];
    if (status) {
      query += ' WHERE eo.status = $1';
      params.push(status);
    }
    
    query += ' ORDER BY eo.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ECO orders:', error);
    res.status(500).json({ error: 'Failed to fetch ECO orders' });
  }
};

// Get single ECO order with all details
export const getECOById = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    // Get ECO order
    const ecoResult = await client.query(`
      SELECT 
        eo.*,
        u1.username as initiated_by_name,
        u2.username as approved_by_name,
        c.part_number as component_part_number,
        c.description as component_description,
        cc.name as category_name,
        m.name as manufacturer_name
      FROM eco_orders eo
      LEFT JOIN users u1 ON eo.initiated_by = u1.id
      LEFT JOIN users u2 ON eo.approved_by = u2.id
      LEFT JOIN components c ON eo.component_id = c.id
      LEFT JOIN component_categories cc ON c.category_id = cc.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      WHERE eo.id = $1
    `, [id]);
    
    if (ecoResult.rows.length === 0) {
      return res.status(404).json({ error: 'ECO order not found' });
    }
    
    const eco = ecoResult.rows[0];
    
    // Get all changes
    const changesResult = await client.query(`
      SELECT * FROM eco_changes WHERE eco_id = $1 ORDER BY created_at
    `, [id]);
    
    // Get all distributor changes
    const distributorsResult = await client.query(`
      SELECT 
        ed.*,
        d.name as distributor_name,
        ca.manufacturer_pn as alternative_manufacturer_pn,
        m.name as alternative_manufacturer_name
      FROM eco_distributors ed
      LEFT JOIN distributors d ON ed.distributor_id = d.id
      LEFT JOIN components_alternative ca ON ed.alternative_id = ca.id
      LEFT JOIN manufacturers m ON ca.manufacturer_id = m.id
      WHERE ed.eco_id = $1
      ORDER BY ed.created_at
    `, [id]);
    
    // Get all alternative parts changes
    const alternativesResult = await client.query(`
      SELECT 
        ea.*,
        m.name as manufacturer_name,
        ca.manufacturer_pn as existing_manufacturer_pn
      FROM eco_alternative_parts ea
      LEFT JOIN manufacturers m ON ea.manufacturer_id = m.id
      LEFT JOIN components_alternative ca ON ea.alternative_id = ca.id
      WHERE ea.eco_id = $1
      ORDER BY ea.created_at
    `, [id]);
    
    // Get all specification changes
    const specificationsResult = await client.query(`
      SELECT 
        es.*,
        cs.spec_name,
        cs.unit
      FROM eco_specifications es
      LEFT JOIN category_specifications cs ON es.category_spec_id = cs.id
      WHERE es.eco_id = $1
      ORDER BY cs.display_order
    `, [id]);
    
    res.json({
      ...eco,
      changes: changesResult.rows,
      distributors: distributorsResult.rows,
      alternatives: alternativesResult.rows,
      specifications: specificationsResult.rows
    });
  } catch (error) {
    console.error('Error fetching ECO details:', error);
    res.status(500).json({ error: 'Failed to fetch ECO details' });
  } finally {
    client.release();
  }
};

// Create new ECO order
export const createECO = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { 
      component_id, 
      part_number, 
      changes, 
      distributors, 
      alternatives, 
      specifications,
      notes 
    } = req.body;
    
    // Generate ECO number
    const ecoNumberResult = await client.query('SELECT generate_eco_number() as eco_number');
    const ecoNumber = ecoNumberResult.rows[0].eco_number;
    
    // Create ECO order
    const ecoResult = await client.query(`
      INSERT INTO eco_orders (eco_number, component_id, part_number, initiated_by, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [ecoNumber, component_id, part_number, req.user.id, notes || null]);
    
    const ecoId = ecoResult.rows[0].id;
    
    // Insert component field changes
    if (changes && changes.length > 0) {
      for (const change of changes) {
        await client.query(`
          INSERT INTO eco_changes (eco_id, field_name, old_value, new_value)
          VALUES ($1, $2, $3, $4)
        `, [ecoId, change.field_name, change.old_value, change.new_value]);
      }
    }
    
    // Insert distributor changes
    if (distributors && distributors.length > 0) {
      for (const dist of distributors) {
        await client.query(`
          INSERT INTO eco_distributors (
            eco_id, alternative_id, distributor_id, action, sku, url, 
            currency, in_stock, stock_quantity, minimum_order_quantity, 
            packaging, price_breaks
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          ecoId, dist.alternative_id || null, dist.distributor_id, dist.action,
          dist.sku, dist.url, dist.currency || 'USD', dist.in_stock || false,
          dist.stock_quantity, dist.minimum_order_quantity || 1,
          dist.packaging, JSON.stringify(dist.price_breaks || [])
        ]);
      }
    }
    
    // Insert alternative parts changes
    if (alternatives && alternatives.length > 0) {
      for (const alt of alternatives) {
        await client.query(`
          INSERT INTO eco_alternative_parts (
            eco_id, alternative_id, action, manufacturer_id, manufacturer_pn
          )
          VALUES ($1, $2, $3, $4, $5)
        `, [ecoId, alt.alternative_id || null, alt.action, alt.manufacturer_id, alt.manufacturer_pn]);
      }
    }
    
    // Insert specification changes
    if (specifications && specifications.length > 0) {
      for (const spec of specifications) {
        await client.query(`
          INSERT INTO eco_specifications (
            eco_id, category_spec_id, old_value, new_value
          )
          VALUES ($1, $2, $3, $4)
        `, [ecoId, spec.category_spec_id, spec.old_value, spec.new_value]);
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json(ecoResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating ECO order:', error);
    res.status(500).json({ error: 'Failed to create ECO order' });
  } finally {
    client.release();
  }
};

// Approve ECO order and apply changes
export const approveECO = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Get ECO order
    const ecoResult = await client.query('SELECT * FROM eco_orders WHERE id = $1', [id]);
    if (ecoResult.rows.length === 0) {
      return res.status(404).json({ error: 'ECO order not found' });
    }
    
    const eco = ecoResult.rows[0];
    if (eco.status !== 'pending') {
      return res.status(400).json({ error: 'ECO order is not pending' });
    }
    
    // Check if this is a deletion ECO
    const deletionCheck = await client.query(`
      SELECT * FROM eco_changes 
      WHERE eco_id = $1 AND field_name IN ('delete_component', '_delete_component')
    `, [id]);
    
    if (deletionCheck.rows.length > 0) {
      // This is a deletion ECO - delete the component
      await client.query('DELETE FROM components WHERE id = $1', [eco.component_id]);
      
      // Update ECO order status
      await client.query(`
        UPDATE eco_orders
        SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [req.user.id, id]);
      
      await client.query('COMMIT');
      return res.json({ message: 'ECO approved - Component deleted successfully' });
    }
    
    // Apply component field changes (for non-deletion ECOs)
    const changesResult = await client.query(`
      SELECT * FROM eco_changes 
      WHERE eco_id = $1 AND field_name NOT IN ('delete_component', '_delete_component')
    `, [id]);
    
    if (changesResult.rows.length > 0) {
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      for (const change of changesResult.rows) {
        updateFields.push(`${change.field_name} = $${paramIndex}`);
        updateValues.push(change.new_value);
        paramIndex++;
      }
      
      if (updateFields.length > 0) {
        updateValues.push(eco.component_id);
        await client.query(`
          UPDATE components 
          SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${paramIndex}
        `, updateValues);
      }
    }
    
    // Apply distributor changes
    const distributorsResult = await client.query('SELECT * FROM eco_distributors WHERE eco_id = $1', [id]);
    for (const dist of distributorsResult.rows) {
      // Ensure price_breaks is properly formatted as JSON
      let priceBreaks = dist.price_breaks;
      if (typeof priceBreaks === 'string') {
        try {
          priceBreaks = JSON.parse(priceBreaks);
        } catch (e) {
          priceBreaks = [];
        }
      }
      
      if (dist.action === 'add') {
        // Check if distributor info already exists before inserting
        const existingDist = await client.query(`
          SELECT id FROM distributor_info
          WHERE ${dist.alternative_id ? 'alternative_id' : 'component_id'} = $1
            AND distributor_id = $2
        `, [dist.alternative_id || eco.component_id, dist.distributor_id]);
        
        if (existingDist.rows.length === 0) {
          await client.query(`
            INSERT INTO distributor_info (
              component_id, alternative_id, distributor_id, sku, url,
              currency, in_stock, stock_quantity, minimum_order_quantity,
              packaging, price_breaks
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            dist.alternative_id ? null : eco.component_id,
            dist.alternative_id,
            dist.distributor_id,
            dist.sku,
            dist.url,
            dist.currency,
            dist.in_stock,
            dist.stock_quantity,
            dist.minimum_order_quantity,
            dist.packaging,
            JSON.stringify(priceBreaks)
          ]);
        } else {
          // If it exists, update it instead
          await client.query(`
            UPDATE distributor_info
            SET sku = $1, url = $2, currency = $3, in_stock = $4,
                stock_quantity = $5, minimum_order_quantity = $6,
                packaging = $7, price_breaks = $8, updated_at = CURRENT_TIMESTAMP
            WHERE ${dist.alternative_id ? 'alternative_id' : 'component_id'} = $9
              AND distributor_id = $10
          `, [
            dist.sku, dist.url, dist.currency, dist.in_stock,
            dist.stock_quantity, dist.minimum_order_quantity,
            dist.packaging, JSON.stringify(priceBreaks),
            dist.alternative_id || eco.component_id,
            dist.distributor_id
          ]);
        }
      } else if (dist.action === 'update') {
        await client.query(`
          UPDATE distributor_info
          SET sku = $1, url = $2, currency = $3, in_stock = $4,
              stock_quantity = $5, minimum_order_quantity = $6,
              packaging = $7, price_breaks = $8, updated_at = CURRENT_TIMESTAMP
          WHERE ${dist.alternative_id ? 'alternative_id' : 'component_id'} = $9
            AND distributor_id = $10
        `, [
          dist.sku, dist.url, dist.currency, dist.in_stock,
          dist.stock_quantity, dist.minimum_order_quantity,
          dist.packaging, JSON.stringify(priceBreaks),
          dist.alternative_id || eco.component_id,
          dist.distributor_id
        ]);
      } else if (dist.action === 'delete') {
        await client.query(`
          DELETE FROM distributor_info
          WHERE ${dist.alternative_id ? 'alternative_id' : 'component_id'} = $1
            AND distributor_id = $2
        `, [dist.alternative_id || eco.component_id, dist.distributor_id]);
      }
    }
    
    // Apply alternative parts changes
    const alternativesResult = await client.query('SELECT * FROM eco_alternative_parts WHERE eco_id = $1', [id]);
    for (const alt of alternativesResult.rows) {
      if (alt.action === 'add') {
        await client.query(`
          INSERT INTO components_alternative (part_number, manufacturer_id, manufacturer_pn)
          VALUES ($1, $2, $3)
        `, [eco.part_number, alt.manufacturer_id, alt.manufacturer_pn]);
      } else if (alt.action === 'update') {
        await client.query(`
          UPDATE components_alternative
          SET manufacturer_id = $1, manufacturer_pn = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [alt.manufacturer_id, alt.manufacturer_pn, alt.alternative_id]);
      } else if (alt.action === 'delete') {
        await client.query('DELETE FROM components_alternative WHERE id = $1', [alt.alternative_id]);
      }
    }
    
    // Apply specification changes
    const specificationsResult = await client.query('SELECT * FROM eco_specifications WHERE eco_id = $1', [id]);
    for (const spec of specificationsResult.rows) {
      await client.query(`
        INSERT INTO component_specification_values (component_id, category_spec_id, spec_value)
        VALUES ($1, $2, $3)
        ON CONFLICT (component_id, category_spec_id)
        DO UPDATE SET spec_value = $3, updated_at = CURRENT_TIMESTAMP
      `, [eco.component_id, spec.category_spec_id, spec.new_value]);
    }
    
    // Update ECO order status
    await client.query(`
      UPDATE eco_orders
      SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [req.user.id, id]);
    
    await client.query('COMMIT');
    res.json({ message: 'ECO order approved and changes applied successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving ECO order:', error);
    res.status(500).json({ error: 'Failed to approve ECO order' });
  } finally {
    client.release();
  }
};

// Reject ECO order
export const rejectECO = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    
    const result = await client.query(`
      UPDATE eco_orders
      SET status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
          rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND status = 'pending'
      RETURNING *
    `, [req.user.id, rejection_reason || null, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ECO order not found or not pending' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error rejecting ECO order:', error);
    res.status(500).json({ error: 'Failed to reject ECO order' });
  } finally {
    client.release();
  }
};

// Delete ECO order (only if pending and created by user)
export const deleteECO = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    // Check if user can delete (must be creator or admin)
    let deleteQuery = `
      DELETE FROM eco_orders
      WHERE id = $1 AND status = 'pending'
    `;
    const params = [id];
    
    // If not admin, restrict to own ECOs
    if (req.user.role !== 'admin') {
      deleteQuery += ' AND initiated_by = $2';
      params.push(req.user.id);
    }
    
    deleteQuery += ' RETURNING *';
    
    const result = await client.query(deleteQuery, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ECO order not found or cannot be deleted' });
    }
    
    res.json({ message: 'ECO order deleted successfully' });
  } catch (error) {
    console.error('Error deleting ECO order:', error);
    res.status(500).json({ error: 'Failed to delete ECO order' });
  } finally {
    client.release();
  }
};
