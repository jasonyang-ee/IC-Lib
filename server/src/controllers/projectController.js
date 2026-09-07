import pool from '../config/database.js';
import { logActivity } from '../services/activityLogService.js';
import { logError } from '../utils/logger.js';
import { PROJECT_STATUSES, isValidProjectStatus } from '../constants/projectStatus.js';
import { normalizeAlternativeClass } from '../constants/alternativeClass.js';

const INVALID_STATUS_ERROR = `Invalid status. Must be one of: ${PROJECT_STATUSES.join(', ')}`;
const INVALID_QUANTITY_ERROR = 'Quantity must be a positive integer no greater than 2147483647';
const isValidQuantity = (quantity) => Number.isInteger(quantity) && quantity > 0 && quantity <= 2147483647;

// Keep integer strings accepted by existing API callers, without coercing
// booleans, arrays, fractions, or an explicit null into a BOM quantity.
const parseQuantity = (quantity) => typeof quantity === 'string' && /^\s*\d+\s*$/.test(quantity)
  ? Number(quantity)
  : quantity;

// Get all projects
export const getAllProjects = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.*,
        created_at(p.id) as created_at,
        COUNT(DISTINCT pc.id) as component_count,
        COALESCE(SUM(pc.quantity), 0) as total_quantity
      FROM projects p
      LEFT JOIN project_components pc ON p.id = pc.project_id
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    logError('Project', 'Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

// Get single project with components
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get project details
    const projectResult = await pool.query(
      'SELECT *, created_at(id) as created_at FROM projects WHERE id = $1',
      [id],
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get project components with full details
    const componentsResult = await pool.query(`
      WITH normalized_price_breaks AS (
        SELECT
          di.component_id,
          di.alternative_id,
          COALESCE(
            NULLIF(REGEXP_REPLACE(price_break.value->>'quantity', '[^0-9.\\-]', '', 'g'), '')::numeric,
            1
          ) AS break_quantity,
          NULLIF(REGEXP_REPLACE(price_break.value->>'price', '[^0-9.\\-]', '', 'g'), '')::numeric AS unit_price,
          ROW_NUMBER() OVER (
            PARTITION BY di.id
            ORDER BY COALESCE(
              NULLIF(REGEXP_REPLACE(price_break.value->>'quantity', '[^0-9.\\-]', '', 'g'), '')::numeric,
              1
            ) ASC
          ) AS break_rank
        FROM distributor_info di
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(di.price_breaks) = 'array' THEN di.price_breaks
            ELSE '[]'::jsonb
          END
        ) AS price_break(value)
        WHERE di.component_id IS NOT NULL OR di.alternative_id IS NOT NULL
      ),
      entry_unit_prices AS (
        SELECT
          component_id,
          alternative_id,
          MIN(unit_price) AS unit_price
        FROM normalized_price_breaks
        WHERE break_rank = 1 AND unit_price IS NOT NULL
        GROUP BY component_id, alternative_id
      )
      SELECT 
        pc.id,
        pc.quantity,
        pc.notes,
        pc.component_id,
        pc.alternative_id,
        CASE 
          WHEN pc.component_id IS NOT NULL THEN 'component'
          ELSE 'alternative'
        END as type,
        -- §V59: raw per-line override, the parent component default, and the
        -- resolved class. base_component is the parent for both direct and
        -- alternative lines, so one COALESCE covers each row type.
        pc.alt_class,
        base_component.alt_class as component_alt_class,
        COALESCE(pc.alt_class, base_component.alt_class) as resolved_alt_class,
        -- Shared component details
        base_component.part_number,
        CASE WHEN pc.component_id IS NOT NULL THEN base_component.manufacturer_pn ELSE NULL END as manufacturer_pn,
        base_component.description,
        base_component.value,
        base_component.package_size,
        get_part_type(
          base_component.category_id,
          base_component.sub_category1,
          base_component.sub_category2,
          base_component.sub_category3,
          base_component.sub_category4
        ) as part_type,
        CASE WHEN pc.component_id IS NOT NULL THEN m.name ELSE NULL END as manufacturer_name,
        cat.name as category_name,
        -- Alternative details
        a.manufacturer_pn as alt_manufacturer_pn,
        am.name as alt_manufacturer_name,
        -- Inventory availability
        CASE 
          WHEN pc.component_id IS NOT NULL THEN i.quantity
          ELSE ai.quantity
        END as available_quantity,
        CASE 
          WHEN pc.component_id IS NOT NULL THEN i.location
          ELSE ai.location
        END as location,
        CASE
          WHEN pc.component_id IS NOT NULL THEN primary_unit_price.unit_price
          ELSE alternative_unit_price.unit_price
        END as unit_price
      FROM project_components pc
      LEFT JOIN components_alternative a ON pc.alternative_id = a.id
      LEFT JOIN components base_component ON COALESCE(pc.component_id, a.component_id) = base_component.id
      LEFT JOIN manufacturers m ON base_component.manufacturer_id = m.id
      LEFT JOIN component_categories cat ON base_component.category_id = cat.id
      LEFT JOIN inventory i ON base_component.id = i.component_id
      LEFT JOIN manufacturers am ON a.manufacturer_id = am.id
      LEFT JOIN inventory_alternative ai ON a.id = ai.alternative_id
      LEFT JOIN entry_unit_prices primary_unit_price
        ON pc.component_id IS NOT NULL
        AND primary_unit_price.component_id = pc.component_id
        AND primary_unit_price.alternative_id IS NULL
      LEFT JOIN entry_unit_prices alternative_unit_price
        ON pc.alternative_id IS NOT NULL
        AND alternative_unit_price.alternative_id = pc.alternative_id
      WHERE pc.project_id = $1
      ORDER BY base_component.part_number, a.manufacturer_pn
    `, [id]);
    
    const project = projectResult.rows[0];
    project.components = componentsResult.rows;
    
    res.json(project);
  } catch (error) {
    logError('Project', 'Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

// Create new project
export const createProject = async (req, res) => {
  try {
    const { name, description, status } = req.body;

    // §V33: reject out-of-domain status at the boundary (DB CHECK is backstop).
    if (!isValidProjectStatus(status)) {
      return res.status(400).json({ error: INVALID_STATUS_ERROR });
    }

    const result = await pool.query(
      `INSERT INTO projects (name, description, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description || null, status || 'active'],
    );
    
    const project = result.rows[0];
    
    // Log activity
    await logActivity(pool, {
      componentId: null,
      userId: req.user?.id || null,
      partNumber: '',
      activityType: 'project_created',
      details: {
        project_id: project.id,
        project_name: name,
        status: project.status,
      },
    });
    
    res.status(201).json(project);
  } catch (error) {
    logError('Project', 'Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

// Update project
export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    // §V33: reject out-of-domain status at the boundary (DB CHECK is backstop).
    if (!isValidProjectStatus(status)) {
      return res.status(400).json({ error: INVALID_STATUS_ERROR });
    }

    const result = await pool.query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           status = COALESCE($3, status)
       WHERE id = $4
       RETURNING *`,
      [name, description, status, id],
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = result.rows[0];
    
    // Log activity
    await logActivity(pool, {
      componentId: null,
      userId: req.user?.id || null,
      partNumber: '',
      activityType: 'project_updated',
      details: {
        project_id: id,
        project_name: project.name,
        status: project.status,
      },
    });
    
    res.json(project);
  } catch (error) {
    logError('Project', 'Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

// Delete project
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get project name before deleting
    const projectResult = await pool.query(
      'SELECT name FROM projects WHERE id = $1',
      [id],
    );
    
    const projectName = projectResult.rows[0]?.name;
    
    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 RETURNING *',
      [id],
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Log activity
    await logActivity(pool, {
      componentId: null,
      userId: req.user?.id || null,
      partNumber: '',
      activityType: 'project_deleted',
      details: {
        project_id: id,
        project_name: projectName,
      },
    });
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    logError('Project', 'Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};

// Add component to project
export const addComponentToProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { component_id, alternative_id, quantity, notes, alt_class } = req.body;

    const requestedQuantity = quantity === undefined ? 1 : parseQuantity(quantity);
    if (!isValidQuantity(requestedQuantity)) {
      return res.status(400).json({ error: INVALID_QUANTITY_ERROR });
    }

    // Validate that only one of component_id or alternative_id is provided
    if ((component_id && alternative_id) || (!component_id && !alternative_id)) {
      return res.status(400).json({
        error: 'Must provide exactly one of component_id or alternative_id',
      });
    }

    // §V59: reject out-of-domain overrides at the API boundary; the DB CHECK
    // constraint is the backstop. An omitted override stores NULL, which
    // resolves to the parent component default.
    const altClass = normalizeAlternativeClass(alt_class);
    if (!altClass.ok) {
      return res.status(400).json({ error: altClass.message });
    }

    // Check if component already exists in this project
    const existingCheck = await pool.query(
      `SELECT id FROM project_components 
       WHERE project_id = $1 AND 
       ((component_id = $2 AND $2 IS NOT NULL) OR (alternative_id = $3 AND $3 IS NOT NULL))`,
      [projectId, component_id || null, alternative_id || null],
    );
    
    if (existingCheck.rows.length > 0) {
      return res.status(409).json({ 
        error: 'This component is already in this project', 
      });
    }
    
    const result = await pool.query(
      `INSERT INTO project_components (project_id, component_id, alternative_id, quantity, notes, alt_class)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [projectId, component_id || null, alternative_id || null, requestedQuantity, notes || null, altClass.value],
    );
    
    const projectComponent = result.rows[0];
    
    // Get project and component info for audit log
    const projectInfo = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    
    let componentInfo;
    if (component_id) {
      componentInfo = await pool.query(
        'SELECT part_number, description FROM components WHERE id = $1',
        [component_id],
      );
    } else if (alternative_id) {
      componentInfo = await pool.query(
        'SELECT ca.manufacturer_pn as part_number, c.description FROM components_alternative ca JOIN components c ON ca.component_id = c.id WHERE ca.id = $1',
        [alternative_id],
      );
    }
    
    // Log activity
    await logActivity(pool, {
      componentId: component_id || null,
      userId: req.user?.id || null,
      partNumber: componentInfo?.rows[0]?.part_number || '',
      activityType: 'component_added_to_project',
      details: {
        project_id: projectId,
        project_name: projectInfo.rows[0]?.name,
        component_id: component_id,
        alternative_id: alternative_id,
        quantity: requestedQuantity,
        part_number: componentInfo?.rows[0]?.part_number,
        alt_class: projectComponent.alt_class,
      },
    });
    
    res.status(201).json(projectComponent);
  } catch (error) {
    logError('Project', 'Error adding component to project:', error);
    res.status(500).json({ error: 'Failed to add component to project' });
  }
};

// Update project component
export const updateProjectComponent = async (req, res) => {
  try {
    const { projectId, componentId } = req.params;
    const { quantity, notes, alt_class } = req.body;

    const requestedQuantity = parseQuantity(quantity);
    if (quantity !== undefined && !isValidQuantity(requestedQuantity)) {
      return res.status(400).json({ error: INVALID_QUANTITY_ERROR });
    }

    // §V59: an omitted alt_class preserves the stored override; an explicit
    // null (or an emptied form control) clears it back to the parent default.
    const altClass = normalizeAlternativeClass(alt_class);
    if (!altClass.ok) {
      return res.status(400).json({ error: altClass.message });
    }

    const result = await pool.query(
      `UPDATE project_components
       SET quantity = COALESCE($1, quantity),
           notes = COALESCE($2, notes),
           alt_class = CASE WHEN $5::boolean THEN $6::char(1) ELSE alt_class END
       WHERE project_id = $3 AND id = $4
       RETURNING *`,
      [requestedQuantity, notes, projectId, componentId, altClass.provided, altClass.value],
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project component not found' });
    }
    
    const projectComponent = result.rows[0];
    
    // Get project info for audit log
    const projectInfo = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    
    // Log activity
    await logActivity(pool, {
      componentId: projectComponent.component_id || null,
      userId: req.user?.id || null,
      partNumber: '',
      activityType: 'project_component_updated',
      details: {
        project_id: projectId,
        project_name: projectInfo.rows[0]?.name,
        component_id: projectComponent.component_id,
        alternative_id: projectComponent.alternative_id,
        quantity: projectComponent.quantity,
        // Only report the override when this request actually set it, so the
        // log distinguishes a deliberate change from an untouched field.
        ...(altClass.provided ? { alt_class: projectComponent.alt_class } : {}),
      },
    });
    
    res.json(projectComponent);
  } catch (error) {
    logError('Project', 'Error updating project component:', error);
    res.status(500).json({ error: 'Failed to update project component' });
  }
};

// Remove component from project
export const removeComponentFromProject = async (req, res) => {
  try {
    const { projectId, componentId } = req.params;
    
    // Get info before deleting
    const componentResult = await pool.query(
      'SELECT component_id, alternative_id FROM project_components WHERE project_id = $1 AND id = $2',
      [projectId, componentId],
    );
    
    const projectInfo = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    
    const result = await pool.query(
      'DELETE FROM project_components WHERE project_id = $1 AND id = $2 RETURNING *',
      [projectId, componentId],
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project component not found' });
    }
    
    // Log activity
    await logActivity(pool, {
      componentId: componentResult.rows[0]?.component_id || null,
      userId: req.user?.id || null,
      partNumber: '',
      activityType: 'component_removed_from_project',
      details: {
        project_id: projectId,
        project_name: projectInfo.rows[0]?.name,
        component_id: componentResult.rows[0]?.component_id,
        alternative_id: componentResult.rows[0]?.alternative_id,
      },
    });
    
    res.json({ message: 'Component removed from project successfully' });
  } catch (error) {
    logError('Project', 'Error removing component from project:', error);
    res.status(500).json({ error: 'Failed to remove component from project' });
  }
};

// Consume all components in a project (decrement inventory)
export const consumeProjectComponents = async (req, res) => {
  let client;
  let releaseError;

  try {
    client = await pool.connect();
    const { id } = req.params;

    await client.query('BEGIN');

    // Get project info
    const projectResult = await client.query('SELECT name FROM projects WHERE id = $1', [id]);
    if (projectResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }
    const projectName = projectResult.rows[0].name;

    // Get all project components with part info
    const componentsResult = await client.query(
      `SELECT pc.*, pc.component_id, pc.alternative_id, pc.quantity,
              c.part_number, c.description
       FROM project_components pc
       LEFT JOIN components c ON pc.component_id = c.id
       LEFT JOIN components_alternative ca ON pc.alternative_id = ca.id
       LEFT JOIN components c2 ON ca.component_id = c2.id
       WHERE pc.project_id = $1`,
      [id],
    );

    const updates = [];
    const errors = [];

    // Existing imports may contain invalid quantities. Reject the entire build
    // before any deduction, so subtracting a negative value cannot add stock.
    const invalidLines = componentsResult.rows.filter(pc => !isValidQuantity(pc.quantity));
    if (invalidLines.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Unable to consume all project components',
        message: 'Correct invalid project quantities before consuming inventory.',
        details: invalidLines.map(pc => ({
          id: pc.component_id || pc.alternative_id,
          requested_quantity: pc.quantity,
          error: INVALID_QUANTITY_ERROR,
        })),
      });
    }

    const getAvailableQuantity = async ({ componentId, alternativeId }) => {
      if (componentId) {
        const result = await client.query(
          'SELECT quantity FROM inventory WHERE component_id = $1',
          [componentId],
        );
        return result.rows[0]?.quantity ?? null;
      }

      const result = await client.query(
        'SELECT quantity FROM inventory_alternative WHERE alternative_id = $1',
        [alternativeId],
      );
      return result.rows[0]?.quantity ?? null;
    };

    for (const pc of componentsResult.rows) {
      if (pc.component_id) {
        // Update main component inventory
        const result = await client.query(
          `UPDATE inventory
           SET quantity = quantity - $1
           WHERE component_id = $2 AND quantity >= $1
           RETURNING quantity`,
          [pc.quantity, pc.component_id],
        );
        if (result.rows.length === 0) {
          const availableQuantity = await getAvailableQuantity({ componentId: pc.component_id });
          errors.push({
            component_id: pc.component_id,
            part_number: pc.part_number || null,
            requested_quantity: pc.quantity,
            available_quantity: availableQuantity,
            error: availableQuantity === null
              ? 'Inventory record not found'
              : `Insufficient inventory: requested ${pc.quantity}, available ${availableQuantity}`,
          });
          continue;
        }
        updates.push({ component_id: pc.component_id, new_quantity: result.rows[0].quantity });

        // Log consumption
        if (pc.part_number) {
          await logActivity(client, {
            componentId: pc.component_id,
            userId: req.user?.id || null,
            partNumber: pc.part_number,
            activityType: 'inventory_consumed',
            details: {
              project_id: id,
              project_name: projectName,
              consumed_quantity: pc.quantity,
              new_quantity: result.rows[0].quantity,
              source: 'project_consumption',
            },
          });
        }
      } else if (pc.alternative_id) {
        // Update alternative inventory
        const result = await client.query(
          `UPDATE inventory_alternative
           SET quantity = quantity - $1
           WHERE alternative_id = $2 AND quantity >= $1
           RETURNING quantity`,
          [pc.quantity, pc.alternative_id],
        );
        if (result.rows.length === 0) {
          const availableQuantity = await getAvailableQuantity({ alternativeId: pc.alternative_id });
          errors.push({
            alternative_id: pc.alternative_id,
            requested_quantity: pc.quantity,
            available_quantity: availableQuantity,
            error: availableQuantity === null
              ? 'Alternative inventory record not found'
              : `Insufficient alternative inventory: requested ${pc.quantity}, available ${availableQuantity}`,
          });
          continue;
        }
        updates.push({ alternative_id: pc.alternative_id, new_quantity: result.rows[0].quantity });
      }
    }

    if (errors.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Unable to consume all project components',
        message: 'One or more project components do not have sufficient inventory.',
        details: errors,
      });
    }

    await client.query('COMMIT');

    res.json({
      message: 'Components consumed successfully',
      updates,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        releaseError = rollbackError;
        logError('Project', 'Error rolling back project consumption:', rollbackError);
      }
    }
    logError('Project', 'Error consuming project components:', error);
    res.status(500).json({ error: 'Failed to consume project components' });
  } finally {
    client?.release(releaseError);
  }
};
