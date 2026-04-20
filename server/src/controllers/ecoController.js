import pool from '../config/database.js';
import { sendECONotification } from '../services/emailService.js';
import { regenerateCadText } from '../services/cadFileService.js';
import { generateECOPdf } from '../services/ecoPdfService.js';
import { getComponentCategoryId, syncCategorySpecification } from '../services/specificationService.js';

// Whitelist of valid component field names to prevent SQL injection
const VALID_COMPONENT_FIELDS = [
  'description', 'value', 'pcb_footprint', 'package_size', 'datasheet_url',
  'approval_status', 'sub_category1', 'sub_category2', 'sub_category3', 'sub_category4',
  'schematic', 'step_model', 'pspice', 'pad_file', 'manufacturer_id', 'manufacturer_pn',
  'category_id', '_status_proposal',
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

const consumeNextEcoNumber = async (client) => {
  let settingsResult = await client.query('SELECT * FROM eco_settings LIMIT 1 FOR UPDATE');

  if (settingsResult.rows.length === 0) {
    settingsResult = await client.query(`
      INSERT INTO eco_settings (prefix, leading_zeros, next_number)
      VALUES ('ECO-', 6, 1)
      RETURNING *
    `);
  }

  const settings = settingsResult.rows[0];
  const prefix = typeof settings.prefix === 'string' ? settings.prefix : 'ECO-';
  const leadingZeros = Number.isInteger(settings.leading_zeros) ? settings.leading_zeros : 6;
  const nextNumber = Number.isInteger(settings.next_number) ? settings.next_number : 1;
  const ecoNumber = `${prefix}${String(nextNumber).padStart(leadingZeros, '0')}`;

  await client.query(
    'UPDATE eco_settings SET next_number = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [nextNumber + 1, settings.id],
  );

  return ecoNumber;
};

// Shared helper: fetch rejection history chain for an ECO by walking parent_eco_id
const fetchRejectionHistory = async (client, parentEcoId) => {
  const chain = [];
  let currentId = parentEcoId;
  const visited = new Set();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);

    const ecoResult = await client.query(`
      SELECT eo.*,
        created_at(eo.id) as created_at,
        u1.username as initiated_by_name,
        u2.username as approved_by_name
      FROM eco_orders eo
      LEFT JOIN users u1 ON eo.initiated_by = u1.id
      LEFT JOIN users u2 ON eo.approved_by = u2.id
      WHERE eo.id = $1
    `, [currentId]);

    if (ecoResult.rows.length === 0) break;
    const parentEco = ecoResult.rows[0];

    const changes = await client.query(`
      SELECT ec.*,
        CASE WHEN ec.field_name = 'category_id' THEN
          (SELECT name FROM component_categories WHERE id::text = ec.old_value) END as old_category_name,
        CASE WHEN ec.field_name = 'category_id' THEN
          (SELECT name FROM component_categories WHERE id::text = ec.new_value) END as new_category_name,
        CASE WHEN ec.field_name = 'manufacturer_id' THEN
          (SELECT name FROM manufacturers WHERE id::text = ec.old_value) END as old_manufacturer_name,
        CASE WHEN ec.field_name = 'manufacturer_id' AND ec.new_value NOT LIKE 'NEW:%' THEN
          (SELECT name FROM manufacturers WHERE id::text = ec.new_value)
        WHEN ec.field_name = 'manufacturer_id' AND ec.new_value LIKE 'NEW:%' THEN
          SUBSTRING(ec.new_value FROM 5) END as new_manufacturer_name
      FROM eco_changes ec WHERE eco_id = $1 ORDER BY id
    `, [currentId]);

    const specs = await client.query(`
      SELECT es.*, cs.spec_name, cs.unit
      FROM eco_specifications es
      LEFT JOIN category_specifications cs ON es.category_spec_id = cs.id
      WHERE es.eco_id = $1 ORDER BY cs.display_order
    `, [currentId]);

    const approvals = await client.query(`
      SELECT ea.*, created_at(ea.id) as created_at,
        u.username as user_name, u.role as user_role,
        eas.stage_name
      FROM eco_approvals ea
      LEFT JOIN users u ON ea.user_id = u.id
      LEFT JOIN eco_approval_stages eas ON ea.stage_id = eas.id
      WHERE ea.eco_id = $1 ORDER BY ea.id
    `, [currentId]);

    const distributors = await client.query(`
      SELECT ed.*, d.name as distributor_name,
        ca.manufacturer_pn as alternative_manufacturer_pn,
        m.name as alternative_manufacturer_name
      FROM eco_distributors ed
      LEFT JOIN distributors d ON ed.distributor_id = d.id
      LEFT JOIN components_alternative ca ON ed.alternative_id = ca.id
      LEFT JOIN manufacturers m ON ca.manufacturer_id = m.id
      WHERE ed.eco_id = $1 ORDER BY ed.id
    `, [currentId]);

    const alternativesResult = await client.query(`
      SELECT ea.id, ea.eco_id, ea.alternative_id, ea.action,
        ea.manufacturer_id, ea.manufacturer_pn, ea.distributors,
        COALESCE(ea.manufacturer_name, m.name) as manufacturer_name,
        ca.manufacturer_pn as existing_manufacturer_pn,
        cam.name as existing_manufacturer_name
      FROM eco_alternative_parts ea
      LEFT JOIN manufacturers m ON ea.manufacturer_id = m.id
      LEFT JOIN components_alternative ca ON ea.alternative_id = ca.id
      LEFT JOIN manufacturers cam ON ca.manufacturer_id = cam.id
      WHERE ea.eco_id = $1 ORDER BY ea.id
    `, [currentId]);

    // Enrich embedded distributor data in alternatives
    const enrichedAlternatives = await Promise.all(alternativesResult.rows.map(async (alt) => {
      let dists = alt.distributors || [];
      if (typeof dists === 'string') {
        try { dists = JSON.parse(dists); } catch { dists = []; }
      }
      if (dists.length > 0) {
        const distIds = [...new Set(dists.map(d => d.distributor_id).filter(Boolean))];
        if (distIds.length > 0) {
          const distNames = await client.query(
            'SELECT id, name FROM distributors WHERE id = ANY($1)',
            [distIds],
          );
          const nameMap = Object.fromEntries(distNames.rows.map(r => [r.id, r.name]));
          dists = dists.map(d => ({ ...d, distributor_name: nameMap[d.distributor_id] || null }));
        }
      }
      return { ...alt, distributors: dists };
    }));

    const cadFiles = await client.query(`
      SELECT ecf.*, cf.file_name as existing_file_name, cf.file_type as existing_file_type
      FROM eco_cad_files ecf
      LEFT JOIN cad_files cf ON ecf.cad_file_id = cf.id
      WHERE ecf.eco_id = $1 ORDER BY ecf.id
    `, [currentId]);

    chain.push({
      ...parentEco,
      changes: changes.rows,
      specifications: specs.rows,
      approvals: approvals.rows,
      distributors: distributors.rows,
      alternatives: enrichedAlternatives,
      cad_files: cadFiles.rows,
    });

    currentId = parentEco.parent_eco_id;
  }

  return chain;
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
        (SELECT string_agg(eas.stage_name, ', ' ORDER BY eas.id)
         FROM eco_approval_stages eas
         WHERE eas.is_active = true AND eas.stage_order = eo.current_stage_order
        ) as current_stage_names,
        (SELECT SUM(eas.required_approvals)
         FROM eco_approval_stages eas
         WHERE eas.is_active = true AND eas.stage_order = eo.current_stage_order
        ) as current_stage_required_approvals,
        (SELECT COUNT(*)
         FROM eco_approvals ea
         JOIN eco_approval_stages eas2 ON ea.stage_id = eas2.id
         WHERE ea.eco_id = eo.id AND eas2.stage_order = eo.current_stage_order AND ea.decision = 'approved'
        ) as current_stage_approval_count
      FROM eco_orders eo
      LEFT JOIN users u1 ON eo.initiated_by = u1.id
      LEFT JOIN users u2 ON eo.approved_by = u2.id
      LEFT JOIN components c ON eo.component_id = c.id
      LEFT JOIN component_categories cc ON c.category_id = cc.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
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

    // For rejected view, only show the latest ECO per eco_number,
    // and exclude eco_numbers that have a final approved or pending/in_review status
    // (those belong in the approved or pending views)
    if (status === 'rejected') {
      const ecoNumbers = [...new Set(result.rows.map(r => r.eco_number))];
      const resolvedNumbers = new Set();
      if (ecoNumbers.length > 0) {
        const resolved = await pool.query(
          'SELECT DISTINCT eco_number FROM eco_orders WHERE eco_number = ANY($1) AND status IN (\'approved\', \'pending\', \'in_review\')',
          [ecoNumbers],
        );
        resolved.rows.forEach(r => resolvedNumbers.add(r.eco_number));
      }

      const seen = new Set();
      const deduped = [];
      for (const row of result.rows) {
        if (resolvedNumbers.has(row.eco_number)) continue;
        if (!seen.has(row.eco_number)) {
          seen.add(row.eco_number);
          deduped.push(row);
        }
      }
      return res.json(deduped);
    }

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
        (SELECT string_agg(eas.stage_name, ', ' ORDER BY eas.id)
         FROM eco_approval_stages eas
         WHERE eas.is_active = true AND eas.stage_order = eo.current_stage_order
        ) as current_stage_names,
        (SELECT SUM(eas.required_approvals)
         FROM eco_approval_stages eas
         WHERE eas.is_active = true AND eas.stage_order = eo.current_stage_order
        ) as current_stage_required_approvals
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
        CASE WHEN ec.field_name = 'manufacturer_id' AND ec.new_value NOT LIKE 'NEW:%' THEN
          (SELECT name FROM manufacturers WHERE id::text = ec.new_value)
        WHEN ec.field_name = 'manufacturer_id' AND ec.new_value LIKE 'NEW:%' THEN
          SUBSTRING(ec.new_value FROM 5)
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
    
    // Get all alternative parts changes (with embedded distributors)
    const alternativesResult = await client.query(`
      SELECT
        ea.id,
        ea.eco_id,
        ea.alternative_id,
        ea.action,
        ea.manufacturer_id,
        ea.manufacturer_pn,
        ea.distributors,
        COALESCE(ea.manufacturer_name, m.name) as manufacturer_name,
        ca.manufacturer_pn as existing_manufacturer_pn,
        cam.name as existing_manufacturer_name
      FROM eco_alternative_parts ea
      LEFT JOIN manufacturers m ON ea.manufacturer_id = m.id
      LEFT JOIN components_alternative ca ON ea.alternative_id = ca.id
      LEFT JOIN manufacturers cam ON ca.manufacturer_id = cam.id
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
        u.role as user_role,
        eas.stage_name,
        eas.stage_order
      FROM eco_approvals ea
      LEFT JOIN users u ON ea.user_id = u.id
      LEFT JOIN eco_approval_stages eas ON ea.stage_id = eas.id
      WHERE ea.eco_id = $1
      ORDER BY eas.stage_order, ea.id
    `, [id]);

    // Get all active approval stages for this ECO's pipeline type, with assigned approvers
    // Fallback: if no stages match the pipeline type, show ALL active stages
    const stagesQuery = `
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
    `;
    let stagesResult = await client.query(stagesQuery, [id]);
    // Filter by pipeline type if the ECO has one
    if (eco.pipeline_type) {
      const filtered = stagesResult.rows.filter(s =>
        Array.isArray(s.pipeline_types) && s.pipeline_types.includes(eco.pipeline_type),
      );
      // Only use filtered results if at least one stage matches; otherwise show all
      if (filtered.length > 0) {
        stagesResult = { rows: filtered };
      }
    }

    // Get CAD file changes
    const cadFilesResult = await client.query(`
      SELECT
        ecf.*,
        cf.file_name as existing_file_name,
        cf.file_type as existing_file_type
      FROM eco_cad_files ecf
      LEFT JOIN cad_files cf ON ecf.cad_file_id = cf.id
      WHERE ecf.eco_id = $1
      ORDER BY ecf.id
    `, [id]);

    // Enrich embedded distributor data in alternatives with distributor names
    const enrichedAlternatives = await Promise.all(alternativesResult.rows.map(async (alt) => {
      let dists = alt.distributors || [];
      if (typeof dists === 'string') {
        try { dists = JSON.parse(dists); } catch { dists = []; }
      }
      if (dists.length > 0) {
        const distIds = [...new Set(dists.map(d => d.distributor_id).filter(Boolean))];
        if (distIds.length > 0) {
          const distNames = await client.query(
            'SELECT id, name FROM distributors WHERE id = ANY($1)',
            [distIds],
          );
          const nameMap = Object.fromEntries(distNames.rows.map(r => [r.id, r.name]));
          dists = dists.map(d => ({ ...d, distributor_name: nameMap[d.distributor_id] || null }));
        }
      }
      return { ...alt, distributors: dists };
    }));

    // Fetch rejection history chain if this ECO has a parent
    const rejectionHistory = eco.parent_eco_id
      ? await fetchRejectionHistory(client, eco.parent_eco_id)
      : [];

    res.json({
      ...eco,
      changes: changesResult.rows,
      distributors: distributorsResult.rows,
      alternatives: enrichedAlternatives,
      specifications: specificationsResult.rows,
      approvals: approvalsResult.rows,
      stages: stagesResult.rows,
      cad_files: cadFilesResult.rows,
      rejection_history: rejectionHistory,
    });
  } catch (error) {
    console.error('Error fetching ECO details:', error);
    res.status(500).json({ error: 'Failed to fetch ECO details' });
  } finally {
    client.release();
  }
};

// Get last rejected ECO for a specific component (for retry panel)
export const getLastRejectedECOByComponent = async (req, res) => {
  const client = await pool.connect();
  try {
    const { componentId } = req.params;

    const ecoResult = await client.query(`
      SELECT
        eo.*,
        created_at(eo.id) as created_at,
        u1.username as initiated_by_name,
        u2.username as approved_by_name,
        c.part_number as component_part_number,
        c.description as component_description
      FROM eco_orders eo
      LEFT JOIN users u1 ON eo.initiated_by = u1.id
      LEFT JOIN users u2 ON eo.approved_by = u2.id
      LEFT JOIN components c ON eo.component_id = c.id
      WHERE eo.component_id = $1 AND eo.status = 'rejected'
      ORDER BY eo.id DESC
      LIMIT 1
    `, [componentId]);

    if (ecoResult.rows.length === 0) {
      return res.json(null);
    }

    const eco = ecoResult.rows[0];

    // Fetch full change data for the rejected ECO
    const changesResult = await client.query(`
      SELECT ec.*,
        CASE WHEN ec.field_name = 'category_id' THEN
          (SELECT name FROM component_categories WHERE id::text = ec.old_value) END as old_category_name,
        CASE WHEN ec.field_name = 'category_id' THEN
          (SELECT name FROM component_categories WHERE id::text = ec.new_value) END as new_category_name,
        CASE WHEN ec.field_name = 'manufacturer_id' THEN
          (SELECT name FROM manufacturers WHERE id::text = ec.old_value) END as old_manufacturer_name,
        CASE WHEN ec.field_name = 'manufacturer_id' AND ec.new_value NOT LIKE 'NEW:%' THEN
          (SELECT name FROM manufacturers WHERE id::text = ec.new_value)
        WHEN ec.field_name = 'manufacturer_id' AND ec.new_value LIKE 'NEW:%' THEN
          SUBSTRING(ec.new_value FROM 5) END as new_manufacturer_name
      FROM eco_changes ec WHERE eco_id = $1 ORDER BY id
    `, [eco.id]);

    const specificationsResult = await client.query(`
      SELECT es.*, cs.spec_name, cs.unit
      FROM eco_specifications es
      LEFT JOIN category_specifications cs ON es.category_spec_id = cs.id
      WHERE es.eco_id = $1 ORDER BY cs.display_order
    `, [eco.id]);

    const approvalsResult = await client.query(`
      SELECT ea.*, created_at(ea.id) as created_at,
        u.username as user_name, u.role as user_role,
        eas.stage_name
      FROM eco_approvals ea
      LEFT JOIN users u ON ea.user_id = u.id
      LEFT JOIN eco_approval_stages eas ON ea.stage_id = eas.id
      WHERE ea.eco_id = $1 ORDER BY ea.id
    `, [eco.id]);

    // Fetch alternative parts changes
    const alternativesResult = await client.query(`
      SELECT
        ea.id, ea.eco_id, ea.alternative_id, ea.action,
        ea.manufacturer_id, ea.manufacturer_pn, ea.distributors,
        COALESCE(ea.manufacturer_name, m.name) as manufacturer_name,
        ca.manufacturer_pn as existing_manufacturer_pn,
        cam.name as existing_manufacturer_name
      FROM eco_alternative_parts ea
      LEFT JOIN manufacturers m ON ea.manufacturer_id = m.id
      LEFT JOIN components_alternative ca ON ea.alternative_id = ca.id
      LEFT JOIN manufacturers cam ON ca.manufacturer_id = cam.id
      WHERE ea.eco_id = $1 ORDER BY ea.id
    `, [eco.id]);

    // Fetch distributor changes
    const distributorsResult = await client.query(`
      SELECT ed.*, d.name as distributor_name
      FROM eco_distributors ed
      LEFT JOIN distributors d ON ed.distributor_id = d.id
      WHERE ed.eco_id = $1 ORDER BY ed.id
    `, [eco.id]);

    // Fetch CAD file changes
    const cadFilesResult = await client.query(`
      SELECT ecf.*, cf.file_name as existing_file_name, cf.file_type as existing_file_type
      FROM eco_cad_files ecf
      LEFT JOIN cad_files cf ON ecf.cad_file_id = cf.id
      WHERE ecf.eco_id = $1 ORDER BY ecf.id
    `, [eco.id]);

    res.json({
      ...eco,
      changes: changesResult.rows,
      specifications: specificationsResult.rows,
      approvals: approvalsResult.rows,
      alternatives: alternativesResult.rows,
      distributors: distributorsResult.rows,
      cad_files: cadFilesResult.rows,
    });
  } catch (error) {
    console.error('[ECO] Error fetching last rejected ECO:', error);
    res.status(500).json({ error: 'Failed to fetch last rejected ECO' });
  } finally {
    client.release();
  }
};

// Helper: detect pipeline type based on what changes are included
const detectPipelineType = (changes = [], specifications = [], cad_files = [], distributors = [], alternatives = []) => {
  const hasStatusChange = changes.some(c => c.field_name === '_status_proposal');
  const hasSpecChanges = specifications.length > 0;
  const hasCadChanges = cad_files.length > 0;
  const hasFieldChanges = changes.some(c => c.field_name !== '_status_proposal');
  const hasDistributorChanges = distributors.length > 0;
  const hasAlternativeChanges = alternatives.length > 0;

  if (hasStatusChange && !hasSpecChanges && !hasCadChanges && !hasFieldChanges && !hasDistributorChanges && !hasAlternativeChanges) {
    const statusChange = changes.find(c => c.field_name === '_status_proposal');
    if (statusChange?.new_value === 'prototype') return 'proto_status_change';
    if (statusChange?.new_value === 'production') return 'prod_status_change';
  }
  if (hasSpecChanges || hasCadChanges) return 'spec_cad';
  if ((hasDistributorChanges || hasAlternativeChanges) && !hasFieldChanges && !hasSpecChanges && !hasCadChanges && !hasStatusChange) return 'distributor';
  return 'general';
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
      cad_files,
      notes,
      parent_eco_id,
    } = req.body;

    const categoryChange = Array.isArray(changes)
      ? changes.find(change => change.field_name === 'category_id' && change.new_value)
      : null;
    let specificationCategoryId = categoryChange?.new_value || null;

    if (!specificationCategoryId && component_id) {
      specificationCategoryId = await getComponentCategoryId(client, component_id);
    }

    const resolvedSpecifications = [];
    if (specifications && specifications.length > 0) {
      for (const spec of specifications) {
        const categorySpec = await syncCategorySpecification(client, specificationCategoryId, spec);
        if (!categorySpec?.id) {
          throw new Error(`Failed to resolve specification definition for "${spec.spec_name || 'Unnamed specification'}"`);
        }

        resolvedSpecifications.push({
          ...spec,
          category_spec_id: categorySpec.id,
        });
      }
    }
    
    // Generate ECO number (reuse parent's number for retries)
    let ecoNumber;
    if (parent_eco_id) {
      const parentResult = await client.query('SELECT eco_number FROM eco_orders WHERE id = $1', [parent_eco_id]);
      ecoNumber = parentResult.rows[0]?.eco_number;
    }
    if (!ecoNumber) {
      ecoNumber = await consumeNextEcoNumber(client);
    }

    // Detect pipeline type based on changes
    const pipelineType = detectPipelineType(changes, resolvedSpecifications, cad_files, distributors, alternatives);

    // Get the first active approval stage order for this pipeline type
    const firstStageResult = await client.query(`
      SELECT MIN(stage_order) as min_order FROM eco_approval_stages
      WHERE is_active = true AND $1 = ANY(pipeline_types)
    `, [pipelineType]);
    const firstStageOrder = firstStageResult.rows[0]?.min_order || null;

    // Create ECO order with current_stage_order and pipeline_type
    const ecoResult = await client.query(`
      INSERT INTO eco_orders (eco_number, component_id, part_number, initiated_by, notes, current_stage_order, pipeline_type, parent_eco_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [ecoNumber, component_id, part_number, req.user.id, notes || null, firstStageOrder, pipelineType, parent_eco_id || null]);
    
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
          ecoId, dist.alternative_id || null, dist.distributor_id || null, dist.action,
          dist.sku, dist.url, dist.currency || 'USD', dist.in_stock || false,
          dist.stock_quantity, dist.minimum_order_quantity || 1,
          dist.packaging, JSON.stringify(dist.price_breaks || []),
        ]);
      }
    }
    
    // Insert alternative parts changes (with embedded distributor data)
    if (alternatives && alternatives.length > 0) {
      for (const alt of alternatives) {
        await client.query(`
          INSERT INTO eco_alternative_parts (
            eco_id, alternative_id, action, manufacturer_id, manufacturer_pn, manufacturer_name, distributors
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          ecoId, alt.alternative_id || null, alt.action,
          alt.manufacturer_id || null, alt.manufacturer_pn || null,
          alt.manufacturer_name || null,
          JSON.stringify(alt.distributors || []),
        ]);
      }
    }
    
    // Insert specification changes
    if (resolvedSpecifications.length > 0) {
      for (const spec of resolvedSpecifications) {
        await client.query(`
          INSERT INTO eco_specifications (
            eco_id, category_spec_id, old_value, new_value
          )
          VALUES ($1, $2, $3, $4)
        `, [ecoId, spec.category_spec_id, spec.old_value, spec.new_value]);
      }
    }

    // Insert CAD file changes (link/unlink)
    if (cad_files && cad_files.length > 0) {
      for (const cf of cad_files) {
        await client.query(`
          INSERT INTO eco_cad_files (eco_id, action, cad_file_id, file_type, file_name)
          VALUES ($1, $2, $3, $4, $5)
        `, [ecoId, cf.action, cf.cad_file_id || null, cf.file_type, cf.file_name]);
      }
    }

    // Log ECO creation activity
    await logECOActivity(client, ecoResult.rows[0], 'eco_initiated', {
      changes_count: changes?.length || 0,
      distributors_count: distributors?.length || 0,
      alternatives_count: alternatives?.length || 0,
      specifications_count: resolvedSpecifications.length,
      cad_files_count: cad_files?.length || 0,
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
  // Get all changes
  const changesResult = await client.query(
    'SELECT * FROM eco_changes WHERE eco_id = $1',
    [id],
  );

  // Extract special changes
  const statusProposal = changesResult.rows.find(c => c.field_name === '_status_proposal');
  const categoryChange = changesResult.rows.find(c => c.field_name === 'category_id');
  const regularChanges = changesResult.rows.filter(c =>
    c.field_name !== '_status_proposal' &&
    c.field_name !== 'category_id' &&
    (!categoryChange || !c.field_name.startsWith('sub_category')),
  );

  let newPartNumber = null;
  let newComponentId = null;

  // --- 1. Apply status proposal ---
  if (statusProposal) {
    await client.query(
      'UPDATE components SET approval_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [statusProposal.new_value, eco.component_id],
    );
  }

  // --- 2. Category change (immutable part number) ---
  if (categoryChange) {
    // Get new category info + admin_settings for leading zeros
    const categoryResult = await client.query(
      'SELECT prefix, leading_zeros FROM component_categories WHERE id = $1',
      [categoryChange.new_value],
    );

    if (categoryResult.rows.length > 0) {
      const { prefix: newPrefix, leading_zeros } = categoryResult.rows[0];

      // Generate new part number in the target category
      const seqResult = await client.query(`
        SELECT MAX(CAST(SUBSTRING(part_number FROM LENGTH($1) + 2) AS INTEGER)) as max_seq
        FROM components
        WHERE part_number LIKE $1 || '-%'
      `, [newPrefix]);
      const nextSeq = (seqResult.rows[0].max_seq || 0) + 1;
      newPartNumber = `${newPrefix}-${String(nextSeq).padStart(leading_zeros || 5, '0')}`;

      // Get the old component data
      const oldComp = await client.query('SELECT * FROM components WHERE id = $1', [eco.component_id]);
      if (oldComp.rows.length === 0) throw new Error('Component not found');
      const old = oldComp.rows[0];

      // Build field overrides from regular changes
      const overrides = {};
      for (const change of regularChanges) {
        if (VALID_COMPONENT_FIELDS.includes(change.field_name) && !change.field_name.startsWith('_')) {
          overrides[change.field_name] = change.new_value;
        }
      }

      // Resolve manufacturer_id if it's a NEW: prefixed name
      if (overrides.manufacturer_id && typeof overrides.manufacturer_id === 'string' && overrides.manufacturer_id.startsWith('NEW:')) {
        const mfgName = overrides.manufacturer_id.substring(4);
        const existing = await client.query('SELECT id FROM manufacturers WHERE name = $1', [mfgName]);
        if (existing.rows.length > 0) {
          overrides.manufacturer_id = existing.rows[0].id;
        } else {
          const created = await client.query('INSERT INTO manufacturers (name) VALUES ($1) RETURNING id', [mfgName]);
          overrides.manufacturer_id = created.rows[0].id;
        }
      }

      // Create new component in the new category
      const newCompResult = await client.query(`
        INSERT INTO components (
          category_id, part_number, manufacturer_id, manufacturer_pn,
          description, value, pcb_footprint, package_size,
          sub_category1, sub_category2, sub_category3, sub_category4,
          schematic, step_model, pspice, pad_file,
          datasheet_url, approval_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `, [
        categoryChange.new_value,
        newPartNumber,
        overrides.manufacturer_id || old.manufacturer_id,
        overrides.manufacturer_pn || old.manufacturer_pn,
        overrides.description || old.description,
        overrides.value || old.value,
        overrides.pcb_footprint || old.pcb_footprint,
        overrides.package_size || old.package_size,
        null, null, null, null, // Reset subcategories for new category
        overrides.schematic || old.schematic,
        overrides.step_model || old.step_model,
        overrides.pspice || old.pspice,
        overrides.pad_file || old.pad_file,
        overrides.datasheet_url || old.datasheet_url,
        statusProposal ? statusProposal.new_value : old.approval_status,
      ]);
      newComponentId = newCompResult.rows[0].id;

      // Copy distributors to new component
      const distRows = await client.query(
        'SELECT * FROM distributor_info WHERE component_id = $1',
        [eco.component_id],
      );
      for (const dist of distRows.rows) {
        await client.query(`
          INSERT INTO distributor_info (
            component_id, distributor_id, sku, url, currency, in_stock,
            stock_quantity, minimum_order_quantity, packaging, price_breaks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (component_id, distributor_id) DO NOTHING
        `, [
          newComponentId, dist.distributor_id, dist.sku, dist.url,
          dist.currency, dist.in_stock, dist.stock_quantity,
          dist.minimum_order_quantity, dist.packaging,
          JSON.stringify(dist.price_breaks || []),
        ]);
      }

      // Copy alternatives to new component
      const altRows = await client.query(
        'SELECT * FROM components_alternative WHERE component_id = $1',
        [eco.component_id],
      );
      for (const alt of altRows.rows) {
        const newAlt = await client.query(`
          INSERT INTO components_alternative (component_id, manufacturer_id, manufacturer_pn)
          VALUES ($1, $2, $3)
          ON CONFLICT (component_id, manufacturer_id, manufacturer_pn) DO NOTHING
          RETURNING id
        `, [newComponentId, alt.manufacturer_id, alt.manufacturer_pn]);

        // Copy alternative's distributors
        if (newAlt.rows.length > 0) {
          const altDists = await client.query(
            'SELECT * FROM distributor_info WHERE alternative_id = $1',
            [alt.id],
          );
          for (const ad of altDists.rows) {
            await client.query(`
              INSERT INTO distributor_info (
                alternative_id, distributor_id, sku, url, currency, in_stock,
                stock_quantity, minimum_order_quantity, packaging, price_breaks
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (alternative_id, distributor_id) DO NOTHING
            `, [
              newAlt.rows[0].id, ad.distributor_id, ad.sku, ad.url,
              ad.currency, ad.in_stock, ad.stock_quantity,
              ad.minimum_order_quantity, ad.packaging,
              JSON.stringify(ad.price_breaks || []),
            ]);
          }
        }
      }

      // Copy CAD file links to new component
      const cadLinks = await client.query(
        'SELECT * FROM component_cad_files WHERE component_id = $1',
        [eco.component_id],
      );
      for (const link of cadLinks.rows) {
        await client.query(`
          INSERT INTO component_cad_files (component_id, cad_file_id)
          VALUES ($1, $2)
          ON CONFLICT (component_id, cad_file_id) DO NOTHING
        `, [newComponentId, link.cad_file_id]);
      }

      // Archive the old component
      await client.query(
        "UPDATE components SET approval_status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [eco.component_id],
      );

      // Update ECO to reference new component for traceability
      await client.query(
        'UPDATE eco_orders SET component_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newComponentId, id],
      );

      // Delete old spec values (new category has different specs)
      await client.query(
        'DELETE FROM component_specification_values WHERE component_id = $1',
        [eco.component_id],
      );
    }
  } else if (regularChanges.length > 0) {
    // --- 3. Regular field changes (no category change) ---
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    for (const change of regularChanges) {
      if (!VALID_COMPONENT_FIELDS.includes(change.field_name)) continue;
      if (change.field_name.startsWith('_')) continue; // Skip virtual fields

      let value = change.new_value;

      // Handle manufacturer_id: find-or-create if value is a "NEW:" prefixed name
      if (change.field_name === 'manufacturer_id' && typeof value === 'string' && value.startsWith('NEW:')) {
        const mfgName = value.substring(4);
        const existing = await client.query('SELECT id FROM manufacturers WHERE name = $1', [mfgName]);
        if (existing.rows.length > 0) {
          value = existing.rows[0].id;
        } else {
          const created = await client.query('INSERT INTO manufacturers (name) VALUES ($1) RETURNING id', [mfgName]);
          value = created.rows[0].id;
        }
      }

      updateFields.push(`${change.field_name} = $${paramIndex}`);
      updateValues.push(value);
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

  // --- 4. Apply distributor changes ---
  const targetComponentId = newComponentId || eco.component_id;
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
      `, [dist.alternative_id || targetComponentId, dist.distributor_id]);

      if (existingDist.rows.length === 0) {
        await client.query(`
          INSERT INTO distributor_info (
            component_id, alternative_id, distributor_id, sku, url,
            currency, in_stock, stock_quantity, minimum_order_quantity,
            packaging, price_breaks
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          dist.alternative_id ? null : targetComponentId, dist.alternative_id,
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
          dist.alternative_id || targetComponentId, dist.distributor_id,
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
        dist.alternative_id || targetComponentId, dist.distributor_id,
      ]);
    } else if (dist.action === 'delete') {
      await client.query(`
        DELETE FROM distributor_info
        WHERE ${dist.alternative_id ? 'alternative_id' : 'component_id'} = $1
          AND distributor_id = $2
      `, [dist.alternative_id || targetComponentId, dist.distributor_id]);
    }
  }

  // --- 5. Apply alternative parts changes ---
  const alternativesResult = await client.query('SELECT * FROM eco_alternative_parts WHERE eco_id = $1', [id]);
  for (const alt of alternativesResult.rows) {
    let altDistributors = alt.distributors || [];
    if (typeof altDistributors === 'string') {
      try { altDistributors = JSON.parse(altDistributors); } catch { altDistributors = []; }
    }

    // Resolve manufacturer: find-or-create by name if manufacturer_id is missing
    let resolvedManufacturerId = alt.manufacturer_id;
    if (!resolvedManufacturerId && alt.manufacturer_name) {
      const existing = await client.query(
        'SELECT id FROM manufacturers WHERE name = $1',
        [alt.manufacturer_name],
      );
      if (existing.rows.length > 0) {
        resolvedManufacturerId = existing.rows[0].id;
      } else {
        const created = await client.query(
          'INSERT INTO manufacturers (name) VALUES ($1) RETURNING id',
          [alt.manufacturer_name],
        );
        resolvedManufacturerId = created.rows[0].id;
      }
    }

    if (alt.action === 'add') {
      // Create the new alternative and get its ID
      const newAltResult = await client.query(`
        INSERT INTO components_alternative (component_id, manufacturer_id, manufacturer_pn)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [targetComponentId, resolvedManufacturerId, alt.manufacturer_pn]);

      // Apply embedded distributor data for this new alternative
      if (newAltResult.rows.length > 0 && altDistributors.length > 0) {
        const newAltId = newAltResult.rows[0].id;
        for (const dist of altDistributors) {
          if (!dist.distributor_id || (!dist.sku && !dist.url)) continue;
          await client.query(`
            INSERT INTO distributor_info (
              alternative_id, distributor_id, sku, url, currency,
              in_stock, stock_quantity, minimum_order_quantity, packaging, price_breaks
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (alternative_id, distributor_id) DO UPDATE
            SET sku = EXCLUDED.sku, url = EXCLUDED.url, updated_at = CURRENT_TIMESTAMP
          `, [
            newAltId, dist.distributor_id, dist.sku || '', dist.url || '',
            dist.currency || 'USD', dist.in_stock || false,
            dist.stock_quantity || null, dist.minimum_order_quantity || 1,
            dist.packaging || null, JSON.stringify(dist.price_breaks || []),
          ]);
        }
      }
    } else if (alt.action === 'update') {
      await client.query(`
        UPDATE components_alternative
        SET manufacturer_id = $1, manufacturer_pn = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [resolvedManufacturerId, alt.manufacturer_pn, alt.alternative_id]);

      // Apply embedded distributor updates for existing alternative
      if (altDistributors.length > 0) {
        for (const dist of altDistributors) {
          if (!dist.distributor_id) continue;
          if (dist.action === 'delete') {
            await client.query(`
              DELETE FROM distributor_info WHERE alternative_id = $1 AND distributor_id = $2
            `, [alt.alternative_id, dist.distributor_id]);
          } else if (dist.sku || dist.url) {
            await client.query(`
              INSERT INTO distributor_info (
                alternative_id, distributor_id, sku, url, currency,
                in_stock, stock_quantity, minimum_order_quantity, packaging, price_breaks
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (alternative_id, distributor_id) DO UPDATE
              SET sku = EXCLUDED.sku, url = EXCLUDED.url, updated_at = CURRENT_TIMESTAMP
            `, [
              alt.alternative_id, dist.distributor_id, dist.sku || '', dist.url || '',
              dist.currency || 'USD', dist.in_stock || false,
              dist.stock_quantity || null, dist.minimum_order_quantity || 1,
              dist.packaging || null, JSON.stringify(dist.price_breaks || []),
            ]);
          }
        }
      }
    } else if (alt.action === 'delete') {
      await client.query('DELETE FROM components_alternative WHERE id = $1', [alt.alternative_id]);
    }
  }

  // --- 6. Apply specification changes ---
  const specificationsResult = await client.query('SELECT * FROM eco_specifications WHERE eco_id = $1', [id]);
  for (const spec of specificationsResult.rows) {
    if (!spec.category_spec_id) continue;

    const newValue = spec.new_value === undefined || spec.new_value === null
      ? ''
      : String(spec.new_value).trim();

    if (newValue === '') {
      await client.query(`
        DELETE FROM component_specification_values
        WHERE component_id = $1 AND category_spec_id = $2
      `, [targetComponentId, spec.category_spec_id]);
      continue;
    }

    await client.query(`
      INSERT INTO component_specification_values (component_id, category_spec_id, spec_value)
      VALUES ($1, $2, $3)
      ON CONFLICT (component_id, category_spec_id)
      DO UPDATE SET spec_value = $3, updated_at = CURRENT_TIMESTAMP
    `, [targetComponentId, spec.category_spec_id, newValue]);
  }

  // --- 7. Apply CAD file changes ---
  const cadFilesResult = await client.query('SELECT * FROM eco_cad_files WHERE eco_id = $1', [id]);
  for (const cf of cadFilesResult.rows) {
    if (cf.action === 'link' && cf.cad_file_id) {
      await client.query(`
        INSERT INTO component_cad_files (component_id, cad_file_id)
        VALUES ($1, $2)
        ON CONFLICT (component_id, cad_file_id) DO NOTHING
      `, [targetComponentId, cf.cad_file_id]);
      await regenerateCadText(targetComponentId, cf.file_type);
    } else if (cf.action === 'unlink' && cf.cad_file_id) {
      await client.query(`
        DELETE FROM component_cad_files
        WHERE component_id = $1 AND cad_file_id = $2
      `, [targetComponentId, cf.cad_file_id]);
      await regenerateCadText(targetComponentId, cf.file_type);
    }
  }

  return {
    deleted: false,
    categoryChange: !!categoryChange,
    statusChange: !!statusProposal,
    newPartNumber,
    newComponentId,
    changesApplied: changesResult.rows.length,
    distributorsApplied: distributorsResult.rows.length,
    alternativesApplied: alternativesResult.rows.length,
    cadFilesApplied: cadFilesResult.rows.length,
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

    // Get current stages info (parallel stages at current_stage_order)
    const currentStageOrder = eco.current_stage_order;

    if (currentStageOrder === null) {
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
        message: 'ECO approved and changes applied successfully',
        status: 'approved',
      });
    }

    // Fetch ALL active stages at the current order, filtered by pipeline type
    const currentStagesResult = await client.query(`
      SELECT * FROM eco_approval_stages
      WHERE is_active = true AND stage_order = $1 AND $2 = ANY(pipeline_types)
      ORDER BY id
    `, [currentStageOrder, eco.pipeline_type]);
    const currentStages = currentStagesResult.rows;

    if (currentStages.length === 0) {
      return res.status(400).json({ error: 'No active approval stages found for the current stage order and pipeline type.' });
    }

    // Find which stage the user is eligible to vote on
    let eligibleStage = null;
    const roleHierarchy = { 'read-only': 0, 'reviewer': 1, 'read-write': 2, 'approver': 3, 'admin': 4 };
    const userLevel = roleHierarchy[req.user.role] || 0;

    for (const stage of currentStages) {
      const requiredLevel = roleHierarchy[stage.required_role] || 3;
      if (userLevel < requiredLevel) continue;

      // Check if specific approvers are assigned to this stage
      const stageApprovers = await client.query(
        'SELECT user_id FROM eco_stage_approvers WHERE stage_id = $1',
        [stage.id],
      );

      if (stageApprovers.rows.length > 0) {
        const assignedUserIds = stageApprovers.rows.map(r => r.user_id);
        if (!assignedUserIds.includes(req.user.id) && req.user.role !== 'admin') continue;
      }

      // Check if user already voted on this stage
      const existingVote = await client.query(
        'SELECT id FROM eco_approvals WHERE eco_id = $1 AND stage_id = $2 AND user_id = $3',
        [id, stage.id, req.user.id],
      );

      if (existingVote.rows.length > 0) continue;

      eligibleStage = stage;
      break;
    }

    if (!eligibleStage) {
      return res.status(403).json({
        error: 'You are not eligible to vote on any stage at the current approval level, or you have already voted.',
      });
    }

    // Record approval vote
    await client.query(`
      INSERT INTO eco_approvals (eco_id, stage_id, user_id, decision, comments)
      VALUES ($1, $2, $3, 'approved', $4)
    `, [id, eligibleStage.id, req.user.id, comments || null]);

    // Update status to in_review if still pending
    if (eco.status === 'pending') {
      await client.query(
        "UPDATE eco_orders SET status = 'in_review', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [id],
      );
    }

    // Check if ALL stages at the current order have met their required_approvals
    let allStagesComplete = true;
    for (const stage of currentStages) {
      const approvalCountResult = await client.query(
        "SELECT COUNT(*) as count FROM eco_approvals WHERE eco_id = $1 AND stage_id = $2 AND decision = 'approved'",
        [id, stage.id],
      );
      const approvalCount = parseInt(approvalCountResult.rows[0].count);
      if (approvalCount < stage.required_approvals) {
        allStagesComplete = false;
        break;
      }
    }

    if (allStagesComplete) {
      // All stages at current order complete — find next stage order
      const nextStageResult = await client.query(`
        SELECT MIN(stage_order) as next_order FROM eco_approval_stages
        WHERE is_active = true AND stage_order > $1 AND $2 = ANY(pipeline_types)
      `, [currentStageOrder, eco.pipeline_type]);

      const nextOrder = nextStageResult.rows[0]?.next_order;

      if (nextOrder) {
        // Advance to next stage order
        await client.query(
          'UPDATE eco_orders SET current_stage_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [nextOrder, id],
        );

        // Get stage names for logging/notification
        const nextStageNames = await client.query(
          "SELECT string_agg(stage_name, ', ' ORDER BY id) as names FROM eco_approval_stages WHERE is_active = true AND stage_order = $1 AND $2 = ANY(pipeline_types)",
          [nextOrder, eco.pipeline_type],
        );
        const currentStageNames = currentStages.map(s => s.stage_name).join(', ');
        const nextNames = nextStageNames.rows[0]?.names || 'Next stage';

        await logECOActivity(client, eco, 'eco_stage_advanced', {
          from_stage: currentStageNames,
          to_stage: nextNames,
          approved_by: req.user.id,
        }, req.user.id);

        await client.query('COMMIT');

        // Send stage advancement notification
        const ecoForEmail = await getECOForEmail(pool, id);
        sendECONotification(ecoForEmail, 'eco_stage_advanced', {
          from_stage: currentStageNames,
          to_stage: nextNames,
        }).catch(err => {
          console.error('Error sending stage advancement notification:', err);
        });

        return res.json({
          message: `Stage(s) "${currentStageNames}" complete. Advanced to "${nextNames}".`,
          status: 'in_review',
          current_stage: nextNames,
        });
      }

      // All stages complete — apply changes and approve
      const result = await applyECOChanges(client, eco, id);
      const finalStageNames = currentStages.map(s => s.stage_name).join(', ');

      await client.query(`
        UPDATE eco_orders
        SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [req.user.id, id]);

      await logECOActivity(client, eco, 'eco_approved', {
        approved_by: req.user.id,
        final_stage: finalStageNames,
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
        message: 'ECO approved and all changes applied successfully',
        status: 'approved',
      });
    }

    // Not all stages complete yet — vote recorded
    await client.query('COMMIT');

    // Get current approval count for the stage the user voted on
    const currentApprovalCount = await pool.query(
      "SELECT COUNT(*) as count FROM eco_approvals WHERE eco_id = $1 AND stage_id = $2 AND decision = 'approved'",
      [id, eligibleStage.id],
    );
    const approvalCount = parseInt(currentApprovalCount.rows[0].count);

    const totalStages = (await pool.query(
      'SELECT COUNT(*) as count FROM eco_approval_stages WHERE is_active = true',
    )).rows[0].count;

    return res.json({
      message: `Approval vote recorded for "${eligibleStage.stage_name}" (${approvalCount}/${eligibleStage.required_approvals}).`,
      status: eco.status === 'pending' ? 'in_review' : eco.status,
      current_stage: eligibleStage.stage_name,
      approvals_received: approvalCount,
      approvals_required: eligibleStage.required_approvals,
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

    // Get current stages info (parallel stages at current_stage_order)
    const currentStageOrder = eco.current_stage_order;
    let rejectionStageName = null;

    // Record rejection vote if stages are configured
    if (currentStageOrder !== null) {
      // Fetch all active stages at this order for the ECO's pipeline type
      const currentStagesResult = await client.query(`
        SELECT * FROM eco_approval_stages
        WHERE is_active = true AND stage_order = $1 AND $2 = ANY(pipeline_types)
        ORDER BY id
      `, [currentStageOrder, eco.pipeline_type]);
      const currentStages = currentStagesResult.rows;

      // Find which stage the user is eligible to vote on
      let eligibleStage = null;
      const roleHierarchy = { 'read-only': 0, 'reviewer': 1, 'read-write': 2, 'approver': 3, 'admin': 4 };
      const userLevel = roleHierarchy[req.user.role] || 0;

      for (const stage of currentStages) {
        const requiredLevel = roleHierarchy[stage.required_role] || 3;
        if (userLevel < requiredLevel) continue;

        // Check if specific approvers are assigned
        const stageApprovers = await client.query(
          'SELECT user_id FROM eco_stage_approvers WHERE stage_id = $1',
          [stage.id],
        );

        if (stageApprovers.rows.length > 0) {
          const assignedUserIds = stageApprovers.rows.map(r => r.user_id);
          if (!assignedUserIds.includes(req.user.id) && req.user.role !== 'admin') continue;
        }

        // Check if user already voted on this stage
        const existingVote = await client.query(
          'SELECT id FROM eco_approvals WHERE eco_id = $1 AND stage_id = $2 AND user_id = $3',
          [id, stage.id, req.user.id],
        );

        if (existingVote.rows.length > 0) continue;

        eligibleStage = stage;
        break;
      }

      if (eligibleStage) {
        await client.query(`
          INSERT INTO eco_approvals (eco_id, stage_id, user_id, decision, comments)
          VALUES ($1, $2, $3, 'rejected', $4)
        `, [id, eligibleStage.id, req.user.id, rejection_reason || null]);
        rejectionStageName = eligibleStage.stage_name;
      } else if (currentStages.length > 0) {
        // User is not eligible for any stage but we still allow rejection to proceed
        rejectionStageName = currentStages.map(s => s.stage_name).join(', ');
      }
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
      stage: rejectionStageName || null,
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

// Generate PDF for an ECO order
export const generateECOPDFEndpoint = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Reuse the same data-fetching logic as getECOById
    const ecoResult = await client.query(`
      SELECT
        eo.*,
        created_at(eo.id) as created_at,
        u1.username as initiated_by_name,
        u2.username as approved_by_name,
        c.part_number as component_part_number,
        c.description as component_description,
        (SELECT string_agg(eas.stage_name, ', ' ORDER BY eas.id)
         FROM eco_approval_stages eas
         WHERE eas.is_active = true AND eas.stage_order = eo.current_stage_order
        ) as current_stage_names
      FROM eco_orders eo
      LEFT JOIN users u1 ON eo.initiated_by = u1.id
      LEFT JOIN users u2 ON eo.approved_by = u2.id
      LEFT JOIN components c ON eo.component_id = c.id
      WHERE eo.id = $1
    `, [id]);

    if (ecoResult.rows.length === 0) {
      return res.status(404).json({ error: 'ECO order not found' });
    }

    const eco = ecoResult.rows[0];

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
        CASE WHEN ec.field_name = 'manufacturer_id' AND ec.new_value NOT LIKE 'NEW:%' THEN
          (SELECT name FROM manufacturers WHERE id::text = ec.new_value)
        WHEN ec.field_name = 'manufacturer_id' AND ec.new_value LIKE 'NEW:%' THEN
          SUBSTRING(ec.new_value FROM 5)
        END as new_manufacturer_name
      FROM eco_changes ec
      WHERE eco_id = $1
      ORDER BY id
    `, [id]);

    const distributorsResult = await client.query(`
      SELECT ed.*, d.name as distributor_name
      FROM eco_distributors ed
      LEFT JOIN distributors d ON ed.distributor_id = d.id
      WHERE ed.eco_id = $1
      ORDER BY ed.id
    `, [id]);

    const alternativesResult = await client.query(`
      SELECT
        ea.id,
        ea.eco_id,
        ea.alternative_id,
        ea.action,
        ea.manufacturer_id,
        ea.manufacturer_pn,
        ea.distributors,
        COALESCE(ea.manufacturer_name, m.name) as manufacturer_name,
        ca.manufacturer_pn as existing_manufacturer_pn,
        cam.name as existing_manufacturer_name
      FROM eco_alternative_parts ea
      LEFT JOIN manufacturers m ON ea.manufacturer_id = m.id
      LEFT JOIN components_alternative ca ON ea.alternative_id = ca.id
      LEFT JOIN manufacturers cam ON ca.manufacturer_id = cam.id
      WHERE ea.eco_id = $1
      ORDER BY ea.id
    `, [id]);

    const specificationsResult = await client.query(`
      SELECT es.*, cs.spec_name, cs.unit
      FROM eco_specifications es
      LEFT JOIN category_specifications cs ON es.category_spec_id = cs.id
      WHERE es.eco_id = $1
      ORDER BY cs.display_order
    `, [id]);

    const approvalsResult = await client.query(`
      SELECT
        ea.*, created_at(ea.id) as created_at,
        u.username as user_name,
        u.role as user_role,
        eas.stage_name, eas.stage_order
      FROM eco_approvals ea
      LEFT JOIN users u ON ea.user_id = u.id
      LEFT JOIN eco_approval_stages eas ON ea.stage_id = eas.id
      WHERE ea.eco_id = $1
      ORDER BY eas.stage_order, ea.id
    `, [id]);

    // Get all active stages - fallback to all if pipeline filter yields nothing
    const pdfStagesQuery = `
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
    `;
    let stagesResult = await client.query(pdfStagesQuery, [id]);
    if (eco.pipeline_type) {
      const filtered = stagesResult.rows.filter(s =>
        Array.isArray(s.pipeline_types) && s.pipeline_types.includes(eco.pipeline_type),
      );
      if (filtered.length > 0) {
        stagesResult = { rows: filtered };
      }
    }

    const cadFilesResult = await client.query(`
      SELECT ecf.*, cf.file_name as existing_file_name, cf.file_type as existing_file_type
      FROM eco_cad_files ecf
      LEFT JOIN cad_files cf ON ecf.cad_file_id = cf.id
      WHERE ecf.eco_id = $1
      ORDER BY ecf.id
    `, [id]);

    // Enrich alternatives with distributor names
    const enrichedAlternatives = await Promise.all(alternativesResult.rows.map(async (alt) => {
      let dists = alt.distributors || [];
      if (typeof dists === 'string') {
        try { dists = JSON.parse(dists); } catch { dists = []; }
      }
      if (dists.length > 0) {
        const distIds = [...new Set(dists.map(d => d.distributor_id).filter(Boolean))];
        if (distIds.length > 0) {
          const distNames = await client.query('SELECT id, name FROM distributors WHERE id = ANY($1)', [distIds]);
          const nameMap = Object.fromEntries(distNames.rows.map(r => [r.id, r.name]));
          dists = dists.map(d => ({ ...d, distributor_name: nameMap[d.distributor_id] || null }));
        }
      }
      return { ...alt, distributors: dists };
    }));

    // Fetch rejection history chain for PDF
    const rejectionHistory = eco.parent_eco_id
      ? await fetchRejectionHistory(client, eco.parent_eco_id)
      : [];

    const ecoData = {
      ...eco,
      changes: changesResult.rows,
      distributors: distributorsResult.rows,
      alternatives: enrichedAlternatives,
      specifications: specificationsResult.rows,
      approvals: approvalsResult.rows,
      stages: stagesResult.rows,
      cad_files: cadFilesResult.rows,
      rejection_history: rejectionHistory,
    };

    // Fetch logo filename from admin settings
    const logoResult = await client.query('SELECT eco_logo_filename FROM admin_settings LIMIT 1');
    const logoFilename = logoResult.rows[0]?.eco_logo_filename || '';

    // Generate PDF
    const pdfDoc = generateECOPdf(ecoData, { logoFilename });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${eco.eco_number}.pdf"`);
    pdfDoc.pipe(res);
  } catch (error) {
    console.error('Error generating ECO PDF:', error);
    res.status(500).json({ error: 'Failed to generate ECO PDF' });
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
    const { stage_name, required_approvals, required_role, pipeline_types } = req.body;

    if (!stage_name) {
      return res.status(400).json({ error: 'Stage name is required' });
    }

    // Validate pipeline_types values
    const validPipelineTypes = ['proto_status_change', 'prod_status_change', 'spec_cad', 'distributor', 'general'];
    const resolvedPipelineTypes = Array.isArray(pipeline_types) && pipeline_types.length > 0
      ? pipeline_types
      : ['general'];
    const invalidTypes = resolvedPipelineTypes.filter(t => !validPipelineTypes.includes(t));
    if (invalidTypes.length > 0) {
      return res.status(400).json({ error: `Invalid pipeline types: ${invalidTypes.join(', ')}. Valid values: ${validPipelineTypes.join(', ')}` });
    }

    // Get the next stage_order
    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(stage_order), 0) + 1 as next_order FROM eco_approval_stages',
    );
    const nextOrder = maxOrderResult.rows[0].next_order;

    const result = await pool.query(`
      INSERT INTO eco_approval_stages (stage_name, stage_order, required_approvals, required_role, pipeline_types)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [stage_name, nextOrder, required_approvals || 1, required_role || 'approver', resolvedPipelineTypes]);

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
    const { stage_name, required_approvals, required_role, is_active, pipeline_types, stage_order } = req.body;

    // Validate pipeline_types if provided
    if (pipeline_types !== undefined) {
      const validPipelineTypes = ['proto_status_change', 'prod_status_change', 'spec_cad', 'distributor', 'general'];
      if (!Array.isArray(pipeline_types) || pipeline_types.length === 0) {
        return res.status(400).json({ error: 'pipeline_types must be a non-empty array' });
      }
      const invalidTypes = pipeline_types.filter(t => !validPipelineTypes.includes(t));
      if (invalidTypes.length > 0) {
        return res.status(400).json({ error: `Invalid pipeline types: ${invalidTypes.join(', ')}. Valid values: ${validPipelineTypes.join(', ')}` });
      }
    }

    const result = await pool.query(`
      UPDATE eco_approval_stages
      SET stage_name = COALESCE($1, stage_name),
          required_approvals = COALESCE($2, required_approvals),
          required_role = COALESCE($3, required_role),
          is_active = COALESCE($4, is_active),
          pipeline_types = COALESCE($5, pipeline_types),
          stage_order = COALESCE($6, stage_order)
      WHERE id = $7
      RETURNING *
    `, [stage_name, required_approvals, required_role, is_active, pipeline_types || null, stage_order, id]);

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

    // Get the stage we're about to delete
    const stageResult = await client.query(
      'SELECT * FROM eco_approval_stages WHERE id = $1',
      [id],
    );
    if (stageResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Approval stage not found' });
    }
    const stage = stageResult.rows[0];

    // Check if this is the only stage at its stage_order
    const siblingCount = await client.query(
      'SELECT COUNT(*) as count FROM eco_approval_stages WHERE stage_order = $1 AND id != $2',
      [stage.stage_order, id],
    );
    const isOnlyStageAtOrder = parseInt(siblingCount.rows[0].count) === 0;

    // Check if any pending/in_review ECOs are at this stage_order and this is the only stage
    if (isOnlyStageAtOrder) {
      const inUse = await client.query(
        "SELECT COUNT(*) as count FROM eco_orders WHERE current_stage_order = $1 AND status IN ('pending', 'in_review')",
        [stage.stage_order],
      );

      if (parseInt(inUse.rows[0].count) > 0) {
        return res.status(400).json({
          error: 'Cannot delete this stage — it is the only stage at its order level and is currently in use by active ECO orders.',
        });
      }
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

    const { stage_ids, stage_orders } = req.body;

    if (stage_orders && typeof stage_orders === 'object' && !Array.isArray(stage_orders)) {
      // Explicit ordering: { stageId: orderNumber } — allows duplicates for parallel stages
      for (const [stageId, orderNumber] of Object.entries(stage_orders)) {
        await client.query(
          'UPDATE eco_approval_stages SET stage_order = $1 WHERE id = $2',
          [orderNumber, stageId],
        );
      }
    } else if (Array.isArray(stage_ids) && stage_ids.length > 0) {
      // Sequential ordering: array of stage IDs in desired order
      for (let i = 0; i < stage_ids.length; i++) {
        await client.query(
          'UPDATE eco_approval_stages SET stage_order = $1 WHERE id = $2',
          [i + 1, stage_ids[i]],
        );
      }
    } else {
      return res.status(400).json({ error: 'Either stage_ids (array) or stage_orders (object) is required' });
    }

    await client.query('COMMIT');

    // Return updated stages
    const result = await pool.query(
      'SELECT * FROM eco_approval_stages ORDER BY stage_order ASC, id ASC',
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
