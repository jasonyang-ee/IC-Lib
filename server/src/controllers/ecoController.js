import pool from '../config/database.js';
import { sendECONotification } from '../services/emailService.js';

// Whitelist of valid component field names to prevent SQL injection
const VALID_COMPONENT_FIELDS = [
  'description', 'value', 'pcb_footprint', 'package_size', 'datasheet_url',
  'approval_status', 'sub_category1', 'sub_category2', 'sub_category3', 'sub_category4',
  'schematic', 'step_model', 'pspice', 'manufacturer_id', 'manufacturer_pn',
  'category_id', '_delete_component',
];

// Helper function to log ECO activities
const logECOActivity = async (client, ecoOrder, activityType, details, userId) => {
  try {
    await client.query(`
      INSERT INTO activity_log (component_id, part_number, activity_type, details)
      VALUES ($1, $2, $3, $4)
    `, [
      ecoOrder.component_id,
      ecoOrder.part_number,
      activityType,
      JSON.stringify({ 
        eco_id: ecoOrder.id, 
        eco_number: ecoOrder.eco_number,
        user_id: userId,
        ...details, 
      }),
    ]);
  } catch (error) {
    console.error('Error logging ECO activity:', error);
  }
};

// Helper to get ECO with full details for email notifications
const getECOForEmail = async (client, ecoId) => {
  const result = await client.query(`
    SELECT 
      eo.*,
      u1.username as initiated_by_name,
      c.description as component_description
    FROM eco_orders eo
    LEFT JOIN users u1 ON eo.initiated_by = u1.id
    LEFT JOIN components c ON eo.component_id = c.id
    WHERE eo.id = $1
  `, [ecoId]);
  return result.rows[0];
};

// Get all ECO orders with details
export const getAllECOs = async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        eo.*,
        created_at(eo.id) as created_at,
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
    
    query += ' ORDER BY eo.id DESC';
    
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
        created_at(eo.id) as created_at,
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
    
    // Get all changes (with category name resolution for category_id changes)
    const changesResult = await client.query(`
      SELECT 
        ec.*,
        CASE WHEN ec.field_name = 'category_id' THEN 
          (SELECT name FROM component_categories WHERE id::text = ec.old_value)
        END as old_category_name,
        CASE WHEN ec.field_name = 'category_id' THEN 
          (SELECT name FROM component_categories WHERE id::text = ec.new_value)
        END as new_category_name,
        CASE WHEN ec.field_name = 'manufacturer_id' THEN 
          (SELECT name FROM manufacturers WHERE id::text = ec.old_value)
        END as old_manufacturer_name,
        CASE WHEN ec.field_name = 'manufacturer_id' THEN 
          (SELECT name FROM manufacturers WHERE id::text = ec.new_value)
        END as new_manufacturer_name
      FROM eco_changes ec 
      WHERE eco_id = $1 
      ORDER BY id
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
      ORDER BY ed.id
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
      ORDER BY ea.id
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
      specifications: specificationsResult.rows,
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
      notes, 
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
    
    // Insert component field changes (with field validation)
    if (changes && changes.length > 0) {
      for (const change of changes) {
        // Validate field_name to prevent SQL injection
        if (!VALID_COMPONENT_FIELDS.includes(change.field_name)) {
          throw new Error(`Invalid field name: ${change.field_name}`);
        }
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
          dist.packaging, JSON.stringify(dist.price_breaks || []),
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
    
    // Log ECO creation activity
    await logECOActivity(client, ecoResult.rows[0], 'eco_initiated', {
      changes_count: changes?.length || 0,
      distributors_count: distributors?.length || 0,
      alternatives_count: alternatives?.length || 0,
      specifications_count: specifications?.length || 0,
      notes: notes,
    }, req.user.id);

    await client.query('COMMIT');
    
    // Send email notification (async, don't block the response)
    const ecoForEmail = await getECOForEmail(pool, ecoResult.rows[0].id);
    sendECONotification(ecoForEmail, 'eco_created').catch(err => {
      console.error('Error sending ECO creation notification:', err);
    });
    
    res.status(201).json(ecoResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating ECO order:', error);
    res.status(500).json({ error: error.message || 'Failed to create ECO order' });
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
    
    // Prevent self-approval (initiator cannot approve their own ECO)
    if (eco.initiated_by === req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You cannot approve your own ECO. Please have another user approve it.' });
    }
    
    // Check if this is a deletion ECO (standardized to _delete_component)
    const deletionCheck = await client.query(`
      SELECT * FROM eco_changes 
      WHERE eco_id = $1 AND field_name = '_delete_component'
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
    
    // Check if there's a category_id change - needs special handling
    const categoryChange = changesResult.rows.find(c => c.field_name === 'category_id');
    let newPartNumber = null;
    
    if (categoryChange) {
      // Get the new category's prefix
      const categoryResult = await client.query(
        'SELECT prefix FROM component_categories WHERE id = $1',
        [categoryChange.new_value],
      );
      
      if (categoryResult.rows.length > 0) {
        const newPrefix = categoryResult.rows[0].prefix;
        
        // Get the next sequence number for this prefix
        const seqResult = await client.query(`
          SELECT MAX(CAST(SUBSTRING(part_number FROM LENGTH($1) + 2) AS INTEGER)) as max_seq
          FROM components
          WHERE part_number LIKE $1 || '-%'
        `, [newPrefix]);
        
        const nextSeq = (seqResult.rows[0].max_seq || 0) + 1;
        newPartNumber = `${newPrefix}-${String(nextSeq).padStart(5, '0')}`;
        
        // Update the component with new category, new part_number, and clear sub-categories
        // MUST be done BEFORE updating alternatives (FK constraint requires part_number to exist)
        const otherChanges = changesResult.rows.filter(c => 
          c.field_name !== 'category_id' && 
          !c.field_name.startsWith('sub_category'),
        );
        
        const updateFields = [
          'category_id = $1',
          'part_number = $2',
          'sub_category1 = NULL',
          'sub_category2 = NULL',
          'sub_category3 = NULL',
          'sub_category4 = NULL',
        ];
        const updateValues = [categoryChange.new_value, newPartNumber];
        let paramIndex = 3;
        
        // Add other non-category changes
        for (const change of otherChanges) {
          if (!VALID_COMPONENT_FIELDS.includes(change.field_name)) {
            console.error(`Skipping invalid field name in ECO: ${change.field_name}`);
            continue;
          }
          updateFields.push(`${change.field_name} = $${paramIndex}`);
          updateValues.push(change.new_value);
          paramIndex++;
        }
        
        updateValues.push(eco.component_id);
        await client.query(`
          UPDATE components 
          SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${paramIndex}
        `, updateValues);
        
        // Now update alternatives to reference the new part_number (component already has new part_number)
        await client.query(`
          UPDATE components_alternative
          SET part_number = $1, updated_at = CURRENT_TIMESTAMP
          WHERE part_number = $2
        `, [newPartNumber, eco.part_number]);
        
        // Clear specifications for this component (new category may have different specs)
        await client.query(
          'DELETE FROM component_specification_values WHERE component_id = $1',
          [eco.component_id],
        );
      }
    } else if (changesResult.rows.length > 0) {
      // Normal update without category change
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      for (const change of changesResult.rows) {
        // Validate field_name to prevent SQL injection
        if (!VALID_COMPONENT_FIELDS.includes(change.field_name)) {
          console.error(`Skipping invalid field name in ECO: ${change.field_name}`);
          continue;
        }
        updateFields.push(`${change.field_name} = $${paramIndex}`);
        updateValues.push(change.new_value);
        paramIndex++;;
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
        } catch {
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
            JSON.stringify(priceBreaks),
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
            dist.distributor_id,
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
          dist.distributor_id,
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
    // Use the new part_number if a category change occurred, otherwise use the ECO's part_number
    const partNumberForAlternatives = newPartNumber || eco.part_number;
    const alternativesResult = await client.query('SELECT * FROM eco_alternative_parts WHERE eco_id = $1', [id]);
    for (const alt of alternativesResult.rows) {
      if (alt.action === 'add') {
        await client.query(`
          INSERT INTO components_alternative (part_number, manufacturer_id, manufacturer_pn)
          VALUES ($1, $2, $3)
        `, [partNumberForAlternatives, alt.manufacturer_id, alt.manufacturer_pn]);
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
    
    // Apply specification changes (skip if category changed - specs were already cleared)
    if (!categoryChange) {
      const specificationsResult = await client.query('SELECT * FROM eco_specifications WHERE eco_id = $1', [id]);
      for (const spec of specificationsResult.rows) {
        await client.query(`
          INSERT INTO component_specification_values (component_id, category_spec_id, spec_value)
          VALUES ($1, $2, $3)
          ON CONFLICT (component_id, category_spec_id)
          DO UPDATE SET spec_value = $3, updated_at = CURRENT_TIMESTAMP
        `, [eco.component_id, spec.category_spec_id, spec.new_value]);
      }
    }
    
    // Update ECO order status
    await client.query(`
      UPDATE eco_orders
      SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [req.user.id, id]);

    // Log ECO approval activity with category change info if applicable
    const specificationsApplied = categoryChange ? 0 : (await client.query('SELECT COUNT(*) FROM eco_specifications WHERE eco_id = $1', [id])).rows[0].count;
    await logECOActivity(client, eco, 'eco_approved', {
      approved_by: req.user.id,
      changes_applied: changesResult.rows.length,
      distributors_applied: distributorsResult.rows.length,
      alternatives_applied: alternativesResult.rows.length,
      specifications_applied: specificationsApplied,
      category_changed: !!categoryChange,
      new_part_number: newPartNumber,
    }, req.user.id);
    
    await client.query('COMMIT');
    
    // Get approver name for email and send notification
    const approverResult = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
    const approverName = approverResult.rows[0]?.username || 'Unknown';
    const ecoForEmail = await getECOForEmail(pool, id);
    sendECONotification(ecoForEmail, 'eco_approved', { approved_by_name: approverName }).catch(err => {
      console.error('Error sending ECO approval notification:', err);
    });
    
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
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { rejection_reason } = req.body;
    
    // First get the ECO order to log activity
    const ecoResult = await client.query('SELECT * FROM eco_orders WHERE id = $1', [id]);
    if (ecoResult.rows.length === 0) {
      return res.status(404).json({ error: 'ECO order not found' });
    }
    
    const eco = ecoResult.rows[0];
    if (eco.status !== 'pending') {
      return res.status(400).json({ error: 'ECO order is not pending' });
    }
    
    const result = await client.query(`
      UPDATE eco_orders
      SET status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
          rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND status = 'pending'
      RETURNING *
    `, [req.user.id, rejection_reason || null, id]);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'ECO order not found or not pending' });
    }
    
    // Log ECO rejection activity
    await logECOActivity(client, eco, 'eco_rejected', {
      rejected_by: req.user.id,
      rejection_reason: rejection_reason || 'No reason provided',
    }, req.user.id);
    
    await client.query('COMMIT');
    
    // Get rejecter name for email and send notification
    const rejecterResult = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
    const rejecterName = rejecterResult.rows[0]?.username || 'Unknown';
    const ecoForEmail = await getECOForEmail(pool, id);
    sendECONotification(ecoForEmail, 'eco_rejected', { rejected_by_name: rejecterName }).catch(err => {
      console.error('Error sending ECO rejection notification:', err);
    });
    
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
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
