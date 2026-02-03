import pool from '../config/database.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    // Get total components
    const totalComponentsResult = await pool.query(
      'SELECT COUNT(*) as count FROM components',
    );

    // Get total categories
    const totalCategoriesResult = await pool.query(
      'SELECT COUNT(*) as count FROM component_categories',
    );

    // Get total inventory items
    const totalInventoryResult = await pool.query(
      'SELECT COUNT(*) as count, SUM(quantity) as total_quantity FROM inventory',
    );

    // Get components without footprints
    const missingFootprintsResult = await pool.query(
      "SELECT COUNT(*) as count FROM components WHERE pcb_footprint IS NULL OR pcb_footprint = ''",
    );

    // Get components without schematic symbols
    const missingSchematicResult = await pool.query(
      "SELECT COUNT(*) as count FROM components WHERE schematic IS NULL OR schematic = ''",
    );

    // Get components without 3D models
    const missing3DModelResult = await pool.query(
      "SELECT COUNT(*) as count FROM components WHERE step_model IS NULL OR step_model = ''",
    );

    // Get components without Pspice models
    const missingPspiceResult = await pool.query(
      "SELECT COUNT(*) as count FROM components WHERE pspice IS NULL OR pspice = ''",
    );

    // Get low stock count
    const lowStockResult = await pool.query(
      'SELECT COUNT(*) as count FROM inventory WHERE quantity <= minimum_quantity AND minimum_quantity > 0',
    );

    // Get recently added components (extract timestamp from uuidv7 id)
    const recentComponentsResult = await pool.query(`
      SELECT COUNT(*) as count FROM components 
      WHERE (uuid_extract_timestamp(id) AT TIME ZONE 'UTC') >= NOW() - INTERVAL '30 days'
    `);

    // Get approval status breakdown
    const approvalStatusResult = await pool.query(`
      SELECT 
        approval_status,
        COUNT(*) as count
      FROM components
      GROUP BY approval_status
    `);

    // Convert to object for easy access
    const approvalStatusCounts = {};
    approvalStatusResult.rows.forEach(row => {
      approvalStatusCounts[row.approval_status || 'new'] = parseInt(row.count);
    });

    res.json({
      totalComponents: parseInt(totalComponentsResult.rows[0].count),
      totalCategories: parseInt(totalCategoriesResult.rows[0].count),
      totalInventoryItems: parseInt(totalInventoryResult.rows[0].count),
      totalInventoryQuantity: parseInt(totalInventoryResult.rows[0].total_quantity || 0),
      missingFootprints: parseInt(missingFootprintsResult.rows[0].count),
      missingSchematic: parseInt(missingSchematicResult.rows[0].count),
      missing3DModel: parseInt(missing3DModelResult.rows[0].count),
      missingPspice: parseInt(missingPspiceResult.rows[0].count),
      lowStockAlerts: parseInt(lowStockResult.rows[0].count),
      recentlyAdded: parseInt(recentComponentsResult.rows[0].count),
      approvalStatus: {
        new: approvalStatusCounts.new || 0,
        temporary: approvalStatusCounts.temporary || 0,
        pending_review: approvalStatusCounts['pending review'] || 0,
        experimental: approvalStatusCounts.experimental || 0,
        approved: approvalStatusCounts.approved || 0,
        archived: approvalStatusCounts.archived || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getRecentActivities = async (req, res, next) => {
  try {
    const limit = req.query.limit || 10;

    const result = await pool.query(`
      SELECT 
        id,
        component_id,
        part_number,
        activity_type,
        details,
        created_at(id) as created_at
      FROM activity_log
      ORDER BY id DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getAllActivities = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        component_id,
        part_number,
        activity_type,
        details,
        created_at(id) as created_at
      FROM activity_log
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const clearAllActivities = async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM activity_log');
    
    res.json({ 
      success: true, 
      message: `Cleared ${result.rowCount} audit log entries`, 
    });
  } catch (error) {
    next(error);
  }
};

export const getCategoryBreakdown = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        cat.name as category,
        COUNT(c.id) as count
      FROM component_categories cat
      LEFT JOIN components c ON cat.id = c.category_id
      GROUP BY cat.name
      ORDER BY count DESC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getExtendedDashboardStats = async (req, res, next) => {
  try {
    // Get total users
    const totalUsersResult = await pool.query(
      'SELECT COUNT(*) as count FROM users',
    );

    // Get total manufacturers
    const totalManufacturersResult = await pool.query(
      'SELECT COUNT(*) as count FROM manufacturers',
    );

    // Get total distributors
    const totalDistributorsResult = await pool.query(
      'SELECT COUNT(*) as count FROM distributors',
    );

    // Get total projects
    const totalProjectsResult = await pool.query(
      'SELECT COUNT(*) as count FROM projects',
    );

    // Get active projects (status = 'active' or 'planning')
    const activeProjectsResult = await pool.query(
      "SELECT COUNT(*) as count FROM projects WHERE status IN ('active', 'planning')",
    );

    // Get total project components
    const totalProjectComponentsResult = await pool.query(
      'SELECT COUNT(*) as count FROM project_components',
    );

    // Get average components per project
    const avgComponentsResult = await pool.query(`
      SELECT COALESCE(ROUND(AVG(component_count)), 0) as avg
      FROM (
        SELECT COUNT(*) as component_count
        FROM project_components
        GROUP BY project_id
      ) as project_counts
    `);

    // Get components with specifications
    const componentsWithSpecsResult = await pool.query(
      'SELECT COUNT(DISTINCT component_id) as count FROM component_specification_values',
    );

    // Get components with alternatives
    const componentsWithAlternativesResult = await pool.query(
      'SELECT COUNT(DISTINCT part_number) as count FROM components_alternative',
    );

    // Get top storage locations
    const topLocationsResult = await pool.query(`
      SELECT location, COUNT(*) as count
      FROM inventory
      WHERE location IS NOT NULL AND location != ''
      GROUP BY location
      ORDER BY count DESC
      LIMIT 10
    `);

    // Get recent user logins
    const recentLoginsResult = await pool.query(`
      SELECT username, role, last_login
      FROM users
      WHERE last_login IS NOT NULL
      ORDER BY last_login DESC
      LIMIT 10
    `);

    res.json({
      totalUsers: parseInt(totalUsersResult.rows[0].count),
      totalManufacturers: parseInt(totalManufacturersResult.rows[0].count),
      totalDistributors: parseInt(totalDistributorsResult.rows[0].count),
      totalProjects: parseInt(totalProjectsResult.rows[0].count),
      activeProjects: parseInt(activeProjectsResult.rows[0].count),
      totalProjectComponents: parseInt(totalProjectComponentsResult.rows[0].count),
      avgComponentsPerProject: parseInt(avgComponentsResult.rows[0].avg || 0),
      componentsWithSpecs: parseInt(componentsWithSpecsResult.rows[0].count),
      componentsWithAlternatives: parseInt(componentsWithAlternativesResult.rows[0].count),
      topLocations: topLocationsResult.rows,
      recentLogins: recentLoginsResult.rows,
    });
  } catch (error) {
    next(error);
  }
};
