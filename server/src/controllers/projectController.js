import pool from '../config/database.js';

// Get all projects
export const getAllProjects = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        COUNT(DISTINCT pc.id) as component_count,
        COALESCE(SUM(pc.quantity), 0) as total_quantity
      FROM projects p
      LEFT JOIN project_components pc ON p.id = pc.project_id
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

// Get single project with components
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get project details
    const projectResult = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get project components with full details
    const componentsResult = await pool.query(`
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
        -- Component details
        c.part_number,
        c.manufacturer_pn,
        c.description,
        c.value,
        m.name as manufacturer_name,
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
        END as location
      FROM project_components pc
      LEFT JOIN components c ON pc.component_id = c.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN inventory i ON c.id = i.component_id
      LEFT JOIN components_alternative a ON pc.alternative_id = a.id
      LEFT JOIN manufacturers am ON a.manufacturer_id = am.id
      LEFT JOIN inventory_alternative ai ON a.id = ai.alternative_id
      WHERE pc.project_id = $1
      ORDER BY c.part_number, a.manufacturer_pn
    `, [id]);
    
    const project = projectResult.rows[0];
    project.components = componentsResult.rows;
    
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

// Create new project
export const createProject = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    
    const result = await pool.query(
      `INSERT INTO projects (name, description, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description || null, status || 'active']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

// Update project
export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    
    const result = await pool.query(
      `UPDATE projects 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           status = COALESCE($3, status)
       WHERE id = $4
       RETURNING *`,
      [name, description, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

// Delete project
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};

// Add component to project
export const addComponentToProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { component_id, alternative_id, quantity, notes } = req.body;
    
    // Validate that only one of component_id or alternative_id is provided
    if ((component_id && alternative_id) || (!component_id && !alternative_id)) {
      return res.status(400).json({ 
        error: 'Must provide exactly one of component_id or alternative_id' 
      });
    }
    
    // Check if component already exists in this project
    const existingCheck = await pool.query(
      `SELECT id FROM project_components 
       WHERE project_id = $1 AND 
       ((component_id = $2 AND $2 IS NOT NULL) OR (alternative_id = $3 AND $3 IS NOT NULL))`,
      [projectId, component_id || null, alternative_id || null]
    );
    
    if (existingCheck.rows.length > 0) {
      return res.status(409).json({ 
        error: 'This component is already in this project' 
      });
    }
    
    const result = await pool.query(
      `INSERT INTO project_components (project_id, component_id, alternative_id, quantity, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, component_id || null, alternative_id || null, quantity || 1, notes || null]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding component to project:', error);
    res.status(500).json({ error: 'Failed to add component to project' });
  }
};

// Update project component
export const updateProjectComponent = async (req, res) => {
  try {
    const { projectId, componentId } = req.params;
    const { quantity, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE project_components 
       SET quantity = COALESCE($1, quantity),
           notes = COALESCE($2, notes)
       WHERE project_id = $3 AND id = $4
       RETURNING *`,
      [quantity, notes, projectId, componentId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project component not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating project component:', error);
    res.status(500).json({ error: 'Failed to update project component' });
  }
};

// Remove component from project
export const removeComponentFromProject = async (req, res) => {
  try {
    const { projectId, componentId } = req.params;
    
    const result = await pool.query(
      'DELETE FROM project_components WHERE project_id = $1 AND id = $2 RETURNING *',
      [projectId, componentId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project component not found' });
    }
    
    res.json({ message: 'Component removed from project successfully' });
  } catch (error) {
    console.error('Error removing component from project:', error);
    res.status(500).json({ error: 'Failed to remove component from project' });
  }
};

// Consume all components in a project (decrement inventory)
export const consumeProjectComponents = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');
    
    // Get all project components
    const componentsResult = await client.query(
      `SELECT pc.*, pc.component_id, pc.alternative_id, pc.quantity
       FROM project_components pc
       WHERE pc.project_id = $1`,
      [id]
    );
    
    const updates = [];
    const errors = [];
    
    for (const pc of componentsResult.rows) {
      try {
        if (pc.component_id) {
          // Update main component inventory
          const result = await client.query(
            `UPDATE inventory 
             SET quantity = GREATEST(0, quantity - $1)
             WHERE component_id = $2
             RETURNING quantity`,
            [pc.quantity, pc.component_id]
          );
          updates.push({ component_id: pc.component_id, new_quantity: result.rows[0].quantity });
        } else if (pc.alternative_id) {
          // Update alternative inventory
          const result = await client.query(
            `UPDATE inventory_alternative 
             SET quantity = GREATEST(0, quantity - $1)
             WHERE alternative_id = $2
             RETURNING quantity`,
            [pc.quantity, pc.alternative_id]
          );
          updates.push({ alternative_id: pc.alternative_id, new_quantity: result.rows[0].quantity });
        }
      } catch (error) {
        errors.push({ 
          id: pc.component_id || pc.alternative_id, 
          error: error.message 
        });
      }
    }
    
    await client.query('COMMIT');
    
    res.json({ 
      message: 'Components consumed successfully',
      updates,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error consuming project components:', error);
    res.status(500).json({ error: 'Failed to consume project components' });
  } finally {
    client.release();
  }
};
