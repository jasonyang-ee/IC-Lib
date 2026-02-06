import pool from '../config/database.js';
import { sendECONotification } from '../services/emailService.js';

// Whitelist of valid component field names to prevent SQL injection
const VALID_COMPONENT_FIELDS = [
  'description', 'value', 'pcb_footprint', 'package_size', 'datasheet_url',
  'approval_status', 'sub_category1', 'sub_category2', 'sub_category3', 'sub_category4',
  'schematic', 'step_model', 'pspice', 'pad_file', 'manufacturer_id', 'manufacturer_pn',
  'category_id', '_delete_component',
];

// Helper function to log ECO activities
const logECOActivity = async (client, ecoOrder, activityType, details, userId) => {
  try {
    await client.query(`
      INSERT INTO activity_log (component_id, user_id, part_number, activity_type, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      ecoOrder.component_id,
      userId || null,
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
        m.name as manufacturer_name,
        eas.stage_name as current_stage_name,
        eas.stage_order as current_stage_order,
        eas.required_approvals as current_stage_required_approvals,
        (SELECT COUNT(*) FROM eco_approvals ea
         WHERE ea.eco_id = eo.id AND ea.stage_id = eo.current_stage_id AND ea.decision = 'approved'
        ) as current_stage_approval_count
      FROM eco_orders eo
      LEFT JOIN users u1 ON eo.initiated_by = u1.id
      LEFT JOIN users u2 ON eo.approved_by = u2.id
      LEFT JOIN components c ON eo.component_id = c.id
      LEFT JOIN component_categories cc ON c.category_id = cc.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      LEFT JOIN eco_approval_stages eas ON eo.current_stage_id = eas.id
    `;

    const params = [];
    if (status) {
      // Support both 'pending' and 'in_review' for the pending filter
      if (status === 'pending') {
        query += " WHERE eo.status IN ('pending', 'in_review')";
      } else {
        query += ' WHERE eo.status = $1';
        params.push(status);
      }
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

    // Get ECO order with stage info
    const ecoResult = await client.query(`
      SELECT
        eo.*,
        created_at(eo.id) as created_at,
        u1.username as initiated_by_name,
        u2.username as approved_by_name,
        c.part_number as component_part_number,
        c.description as component_description,
        cc.name as category_name,
        m.name as manufacturer_name,
        eas.stage_name as current_stage_name,
        eas.stage_order as current_stage_order,
        eas.required_approvals as current_stage_required_approvals
      FROM eco_orders eo
      LEFT JOIN users u1 ON eo.initiated_by = u1.id
      LEFT JOIN users u2 ON eo.approved_by = u2.id
      LEFT JOIN components c ON eo.component_id = c.id
      LEFT JOIN component_categories cc ON c.category_id = cc.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      LEFT JOIN eco_approval_stages eas ON eo.current_stage_id = eas.id
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

    // Get all approval votes for this ECO
    const approvalsResult = await client.query(`
      SELECT
        ea.*,
        created_at(ea.id) as created_at,
        u.username as user_name,
        eas.stage_name,
        eas.stage_order
      FROM eco_approvals ea
      LEFT JOIN users u ON ea.user_id = u.id
      LEFT JOIN eco_approval_stages eas ON ea.stage_id = eas.id
      WHERE ea.eco_id = $1
      ORDER BY eas.stage_order, ea.id
    `, [id]);

    // Get all active approval stages with assigned approvers
    const stagesResult = await client.query(`
      SELECT
        eas.*,
        (SELECT COUNT(*) FROM eco_approvals ea
         WHERE ea.eco_id = $1 AND ea.stage_id = eas.id AND ea.decision = 'approved'
        ) as approval_count,
        COALESCE(
          (SELECT json_agg(json_build_object('user_id', u.id, 'username', u.username, 'role', u.role))
           FROM eco_stage_approvers esa
           JOIN users u ON esa.user_id = u.id
           WHERE esa.stage_id = eas.id
          ), '[]'::json
        ) as assigned_approvers
      FROM eco_approval_stages eas
      WHERE eas.is_active = true
      ORDER BY eas.stage_order
    `, [id]);

    res.json({
      ...eco,
      changes: changesResult.rows,
      distributors: distributorsResult.rows,
      alternatives: alternativesResult.rows,
      specifications: specificationsResult.rows,
      approvals: approvalsResult.rows,
      stages: stagesResult.rows,
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

    // Get the first active approval stage
    const firstStageResult = await client.query(`
      SELECT id FROM eco_approval_stages
      WHERE is_active = true
      ORDER BY stage_order ASC
      LIMIT 1
    `);
    const firstStageId = firstStageResult.rows[0]?.id || null;

    // Create ECO order with current_stage_id set to first stage
    const ecoResult = await client.query(`
      INSERT INTO eco_orders (eco_number, component_id, part_number, initiated_by, notes, current_stage_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [ecoNumber, component_id, part_number, req.user.id, notes || null, firstStageId]);
    
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

// Helper: Apply all ECO changes to the component (called when final stage is complete)
const applyECOChanges = async (client, eco, id) => {
  // Check if this is a deletion ECO
  const deletionCheck = await client.query(`
    SELECT * FROM eco_changes
    WHERE eco_id = $1 AND field_name = '_delete_component'
  `, [id]);

  if (deletionCheck.rows.length > 0) {
    await client.query('DELETE FROM components WHERE id = $1', [eco.component_id]);
    return { deleted: true };
  }

  // Apply component field changes
  const changesResult = await client.query(`
    SELECT * FROM eco_changes
    WHERE eco_id = $1 AND field_name NOT IN ('delete_component', '_delete_component')
  `, [id]);

  const categoryChange = changesResult.rows.find(c => c.field_name === 'category_id');
  let newPartNumber = null;

  if (categoryChange) {
    const categoryResult = await client.query(
      'SELECT prefix FROM component_categories WHERE id = $1',
      [categoryChange.new_value],
    );

    if (categoryResult.rows.length > 0) {
      const newPrefix = categoryResult.rows[0].prefix;
      const seqResult = await client.query(`
        SELECT MAX(CAST(SUBSTRING(part_number FROM LENGTH($1) + 2) AS INTEGER)) as max_seq
        FROM components
        WHERE part_number LIKE $1 || '-%'
      `, [newPrefix]);

      const nextSeq = (seqResult.rows[0].max_seq || 0) + 1;
      newPartNumber = `${newPrefix}-${String(nextSeq).padStart(5, '0')}`;

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

      for (const change of otherChanges) {
        if (!VALID_COMPONENT_FIELDS.includes(change.field_name)) continue;
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

      await client.query(
        'DELETE FROM component_specification_values WHERE component_id = $1',
        [eco.component_id],
      );
    }
  } else if (changesResult.rows.length > 0) {
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    for (const change of changesResult.rows) {
      if (!VALID_COMPONENT_FIELDS.includes(change.field_name)) continue;
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
    let priceBreaks = dist.price_breaks;
    if (typeof priceBreaks === 'string') {
      try { priceBreaks = JSON.parse(priceBreaks); } catch { priceBreaks = []; }
    }

    if (dist.action === 'add') {
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
          dist.alternative_id ? null : eco.component_id, dist.alternative_id,
          dist.distributor_id, dist.sku, dist.url, dist.currency, dist.in_stock,
          dist.stock_quantity, dist.minimum_order_quantity, dist.packaging,
          JSON.stringify(priceBreaks),
        ]);
      } else {
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
          dist.alternative_id || eco.component_id, dist.distributor_id,
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
        dist.alternative_id || eco.component_id, dist.distributor_id,
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
        INSERT INTO components_alternative (component_id, manufacturer_id, manufacturer_pn)
        VALUES ($1, $2, $3)
      `, [eco.component_id, alt.manufacturer_id, alt.manufacturer_pn]);
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

  // Apply specification changes (skip if category changed)
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

  return {
    deleted: false,
    categoryChange: !!categoryChange,
    newPartNumber,
    changesApplied: changesResult.rows.length,
    distributorsApplied: distributorsResult.rows.length,
    alternativesApplied: alternativesResult.rows.length,
  };
};

// Approve ECO order (vote-based multi-stage)
export const approveECO = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { comments } = req.body;

    // Get ECO order
    const ecoResult = await client.query('SELECT * FROM eco_orders WHERE id = $1', [id]);
    if (ecoResult.rows.length === 0) {
      return res.status(404).json({ error: 'ECO order not found' });
    }

    const eco = ecoResult.rows[0];
    if (eco.status !== 'pending' && eco.status !== 'in_review') {
      return res.status(400).json({ error: 'ECO order is not pending approval' });
    }

    // Prevent self-approval (initiator cannot approve their own ECO, unless admin)
    if (eco.initiated_by === req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You cannot approve your own ECO. Please have another user approve it.' });
    }

    // Get current stage info
    const currentStage = eco.current_stage_id
      ? (await client.query('SELECT * FROM eco_approval_stages WHERE id = $1', [eco.current_stage_id])).rows[0]
      : null;

    if (!currentStage) {
      // No stages configured — fall back to single-approval (backward compat)
      const result = await applyECOChanges(client, eco, id);

      await client.query(`
        UPDATE eco_orders
        SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [req.user.id, id]);

      await logECOActivity(client, eco, 'eco_approved', {
        approved_by: req.user.id,
        ...result,
      }, req.user.id);

      await client.query('COMMIT');

      const approverResult = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
      const approverName = approverResult.rows[0]?.username || 'Unknown';
      const ecoForEmail = await getECOForEmail(pool, id);
      sendECONotification(ecoForEmail, 'eco_approved', { approved_by_name: approverName }).catch(err => {
        console.error('Error sending ECO approval notification:', err);
      });

      return res.json({
        message: result.deleted
          ? 'ECO approved - Component deleted successfully'
          : 'ECO approved and changes applied successfully',
        status: 'approved',
      });
    }

    // Check if user has required role for this stage
    const roleHierarchy = { 'read-only': 0, 'read-write': 1, 'approver': 2, 'admin': 3 };
    const userLevel = roleHierarchy[req.user.role] || 0;
    const requiredLevel = roleHierarchy[currentStage.required_role] || 2;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: `This approval stage requires "${currentStage.required_role}" role or higher.`,
      });
    }

    // Check if specific approvers are assigned to this stage
    const stageApprovers = await client.query(
      'SELECT user_id FROM eco_stage_approvers WHERE stage_id = $1',
      [currentStage.id],
    );

    if (stageApprovers.rows.length > 0) {
      const assignedUserIds = stageApprovers.rows.map(r => r.user_id);
      if (!assignedUserIds.includes(req.user.id) && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'You are not assigned as an approver for this stage.',
        });
      }
    }

    // Check if user already voted on this stage
    const existingVote = await client.query(
      'SELECT id FROM eco_approvals WHERE eco_id = $1 AND stage_id = $2 AND user_id = $3',
      [id, currentStage.id, req.user.id],
    );

    if (existingVote.rows.length > 0) {
      return res.status(400).json({ error: 'You have already voted on this approval stage.' });
    }

    // Record approval vote
    await client.query(`
      INSERT INTO eco_approvals (eco_id, stage_id, user_id, decision, comments)
      VALUES ($1, $2, $3, 'approved', $4)
    `, [id, currentStage.id, req.user.id, comments || null]);

    // Update status to in_review if still pending
    if (eco.status === 'pending') {
      await client.query(
        "UPDATE eco_orders SET status = 'in_review', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [id],
      );
    }

    // Count approvals for current stage
    const approvalCountResult = await client.query(
      "SELECT COUNT(*) as count FROM eco_approvals WHERE eco_id = $1 AND stage_id = $2 AND decision = 'approved'",
      [id, currentStage.id],
    );
    const approvalCount = parseInt(approvalCountResult.rows[0].count);

    // Check if current stage has enough approvals
    if (approvalCount >= currentStage.required_approvals) {
      // Stage complete — check if there's a next stage
      const nextStageResult = await client.query(`
        SELECT * FROM eco_approval_stages
        WHERE is_active = true AND stage_order > $1
        ORDER BY stage_order ASC
        LIMIT 1
      `, [currentStage.stage_order]);

      if (nextStageResult.rows.length > 0) {
        // Advance to next stage
        const nextStage = nextStageResult.rows[0];
        await client.query(
          'UPDATE eco_orders SET current_stage_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [nextStage.id, id],
        );

        await logECOActivity(client, eco, 'eco_stage_advanced', {
          from_stage: currentStage.stage_name,
          to_stage: nextStage.stage_name,
          approved_by: req.user.id,
        }, req.user.id);

        await client.query('COMMIT');

        // Send stage advancement notification
        const ecoForEmail = await getECOForEmail(pool, id);
        sendECONotification(ecoForEmail, 'eco_stage_advanced', {
          from_stage: currentStage.stage_name,
          to_stage: nextStage.stage_name,
        }).catch(err => {
          console.error('Error sending stage advancement notification:', err);
        });

        return res.json({
          message: `Stage "${currentStage.stage_name}" complete. Advanced to "${nextStage.stage_name}".`,
          status: 'in_review',
          current_stage: nextStage.stage_name,
        });
      }

      // All stages complete — apply changes and approve
      const result = await applyECOChanges(client, eco, id);

      await client.query(`
        UPDATE eco_orders
        SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [req.user.id, id]);

      await logECOActivity(client, eco, 'eco_approved', {
        approved_by: req.user.id,
        final_stage: currentStage.stage_name,
        ...result,
      }, req.user.id);

      await client.query('COMMIT');

      const approverResult = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
      const approverName = approverResult.rows[0]?.username || 'Unknown';
      const ecoForEmail = await getECOForEmail(pool, id);
      sendECONotification(ecoForEmail, 'eco_approved', { approved_by_name: approverName }).catch(err => {
        console.error('Error sending ECO approval notification:', err);
      });

      return res.json({
        message: result.deleted
          ? 'ECO approved - Component deleted successfully'
          : 'ECO approved and all changes applied successfully',
        status: 'approved',
      });
    }

    // Not enough approvals yet — vote recorded
    await client.query('COMMIT');

    const totalStages = (await pool.query(
      'SELECT COUNT(*) as count FROM eco_approval_stages WHERE is_active = true',
    )).rows[0].count;

    return res.json({
      message: `Approval vote recorded for "${currentStage.stage_name}" (${approvalCount}/${currentStage.required_approvals}).`,
      status: eco.status === 'pending' ? 'in_review' : eco.status,
      current_stage: currentStage.stage_name,
      approvals_received: approvalCount,
      approvals_required: currentStage.required_approvals,
      total_stages: parseInt(totalStages),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving ECO order:', error);
    res.status(500).json({ error: 'Failed to approve ECO order' });
  } finally {
    client.release();
  }
};

// Reject ECO order (vote-based, records rejection at current stage)
export const rejectECO = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { rejection_reason } = req.body;

    // Get ECO order
    const ecoResult = await client.query('SELECT * FROM eco_orders WHERE id = $1', [id]);
    if (ecoResult.rows.length === 0) {
      return res.status(404).json({ error: 'ECO order not found' });
    }

    const eco = ecoResult.rows[0];
    if (eco.status !== 'pending' && eco.status !== 'in_review') {
      return res.status(400).json({ error: 'ECO order is not pending approval' });
    }

    // Get current stage info
    const currentStage = eco.current_stage_id
      ? (await client.query('SELECT * FROM eco_approval_stages WHERE id = $1', [eco.current_stage_id])).rows[0]
      : null;

    // Record rejection vote if stages are configured
    if (currentStage) {
      // Check if user already voted on this stage
      const existingVote = await client.query(
        'SELECT id FROM eco_approvals WHERE eco_id = $1 AND stage_id = $2 AND user_id = $3',
        [id, currentStage.id, req.user.id],
      );

      if (existingVote.rows.length > 0) {
        return res.status(400).json({ error: 'You have already voted on this approval stage.' });
      }

      await client.query(`
        INSERT INTO eco_approvals (eco_id, stage_id, user_id, decision, comments)
        VALUES ($1, $2, $3, 'rejected', $4)
      `, [id, currentStage.id, req.user.id, rejection_reason || null]);
    }

    // Reject the ECO
    const result = await client.query(`
      UPDATE eco_orders
      SET status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
          rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [req.user.id, rejection_reason || null, id]);

    // Log ECO rejection activity
    await logECOActivity(client, eco, 'eco_rejected', {
      rejected_by: req.user.id,
      rejection_reason: rejection_reason || 'No reason provided',
      stage: currentStage?.stage_name || null,
    }, req.user.id);

    await client.query('COMMIT');

    // Send email notification (async)
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

// Delete ECO order (only if pending/in_review and created by user, or admin)
export const deleteECO = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Check if user can delete (must be creator or admin)
    let deleteQuery = `
      DELETE FROM eco_orders
      WHERE id = $1 AND status IN ('pending', 'in_review')
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

// ============================================================================
// Approval Stage Management (Settings)
// ============================================================================

// Get all approval stages (with assigned approvers)
export const getApprovalStages = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        eas.*,
        COALESCE(
          (SELECT json_agg(json_build_object('user_id', u.id, 'username', u.username, 'role', u.role) ORDER BY u.username)
           FROM eco_stage_approvers esa
           JOIN users u ON esa.user_id = u.id
           WHERE esa.stage_id = eas.id
          ), '[]'::json
        ) as assigned_approvers
      FROM eco_approval_stages eas
      ORDER BY eas.stage_order ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching approval stages:', error);
    res.status(500).json({ error: 'Failed to fetch approval stages' });
  }
};

// Create a new approval stage
export const createApprovalStage = async (req, res) => {
  try {
    const { stage_name, required_approvals, required_role } = req.body;

    if (!stage_name) {
      return res.status(400).json({ error: 'Stage name is required' });
    }

    // Get the next stage_order
    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(stage_order), 0) + 1 as next_order FROM eco_approval_stages',
    );
    const nextOrder = maxOrderResult.rows[0].next_order;

    const result = await pool.query(`
      INSERT INTO eco_approval_stages (stage_name, stage_order, required_approvals, required_role)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [stage_name, nextOrder, required_approvals || 1, required_role || 'approver']);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating approval stage:', error);
    res.status(500).json({ error: 'Failed to create approval stage' });
  }
};

// Update an approval stage
export const updateApprovalStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage_name, required_approvals, required_role, is_active } = req.body;

    const result = await pool.query(`
      UPDATE eco_approval_stages
      SET stage_name = COALESCE($1, stage_name),
          required_approvals = COALESCE($2, required_approvals),
          required_role = COALESCE($3, required_role),
          is_active = COALESCE($4, is_active)
      WHERE id = $5
      RETURNING *
    `, [stage_name, required_approvals, required_role, is_active, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval stage not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating approval stage:', error);
    res.status(500).json({ error: 'Failed to update approval stage' });
  }
};

// Delete an approval stage
export const deleteApprovalStage = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Check if any pending/in_review ECOs use this stage
    const inUse = await client.query(
      "SELECT COUNT(*) as count FROM eco_orders WHERE current_stage_id = $1 AND status IN ('pending', 'in_review')",
      [id],
    );

    if (parseInt(inUse.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete this stage — it is currently in use by active ECO orders.',
      });
    }

    const result = await client.query(
      'DELETE FROM eco_approval_stages WHERE id = $1 RETURNING *',
      [id],
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Approval stage not found' });
    }

    // Re-order remaining stages to fill gaps
    await client.query(`
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY stage_order) as new_order
        FROM eco_approval_stages
      )
      UPDATE eco_approval_stages
      SET stage_order = ordered.new_order
      FROM ordered
      WHERE eco_approval_stages.id = ordered.id
    `);

    await client.query('COMMIT');
    res.json({ message: 'Approval stage deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting approval stage:', error);
    res.status(500).json({ error: 'Failed to delete approval stage' });
  } finally {
    client.release();
  }
};

// Reorder approval stages
export const reorderApprovalStages = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { stage_ids } = req.body; // Array of stage IDs in desired order

    if (!Array.isArray(stage_ids) || stage_ids.length === 0) {
      return res.status(400).json({ error: 'stage_ids array is required' });
    }

    // Temporarily set all orders to negative to avoid unique constraint conflicts
    await client.query(
      'UPDATE eco_approval_stages SET stage_order = -stage_order WHERE id = ANY($1)',
      [stage_ids],
    );

    // Update each stage with its new order
    for (let i = 0; i < stage_ids.length; i++) {
      await client.query(
        'UPDATE eco_approval_stages SET stage_order = $1 WHERE id = $2',
        [i + 1, stage_ids[i]],
      );
    }

    await client.query('COMMIT');

    // Return updated stages
    const result = await pool.query(
      'SELECT * FROM eco_approval_stages ORDER BY stage_order ASC',
    );
    res.json(result.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reordering approval stages:', error);
    res.status(500).json({ error: 'Failed to reorder approval stages' });
  } finally {
    client.release();
  }
};

// ============================================================================
// Stage Approver Management
// ============================================================================

// Set approvers for a stage (replaces existing assignments)
export const setStageApprovers = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params; // stage_id
    const { user_ids } = req.body; // Array of user UUIDs

    if (!Array.isArray(user_ids)) {
      return res.status(400).json({ error: 'user_ids array is required' });
    }

    // Verify stage exists
    const stageResult = await client.query(
      'SELECT id FROM eco_approval_stages WHERE id = $1',
      [id],
    );
    if (stageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Approval stage not found' });
    }

    // Clear existing approvers for this stage
    await client.query('DELETE FROM eco_stage_approvers WHERE stage_id = $1', [id]);

    // Insert new approvers
    if (user_ids.length > 0) {
      const values = user_ids.map((userId, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO eco_stage_approvers (stage_id, user_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [id, ...user_ids],
      );
    }

    await client.query('COMMIT');

    // Return updated approvers
    const result = await pool.query(`
      SELECT u.id as user_id, u.username, u.role
      FROM eco_stage_approvers esa
      JOIN users u ON esa.user_id = u.id
      WHERE esa.stage_id = $1
      ORDER BY u.username
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error setting stage approvers:', error);
    res.status(500).json({ error: 'Failed to set stage approvers' });
  } finally {
    client.release();
  }
};
