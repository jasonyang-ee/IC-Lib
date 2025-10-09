import pool from '../config/database.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    // Get total components
    const totalComponentsResult = await pool.query(
      'SELECT COUNT(*) as count FROM components'
    );

    // Get total categories
    const totalCategoriesResult = await pool.query(
      'SELECT COUNT(*) as count FROM component_categories'
    );

    // Get total inventory items
    const totalInventoryResult = await pool.query(
      'SELECT COUNT(*) as count, SUM(quantity) as total_quantity FROM inventory'
    );

    // Get components without footprints
    const missingFootprintsResult = await pool.query(
      "SELECT COUNT(*) as count FROM components WHERE pcb_footprint IS NULL OR pcb_footprint = ''"
    );

    // Get low stock count
    const lowStockResult = await pool.query(
      'SELECT COUNT(*) as count FROM inventory WHERE quantity <= minimum_quantity AND minimum_quantity > 0'
    );

    // Get recently added components
    const recentComponentsResult = await pool.query(`
      SELECT COUNT(*) as count FROM components 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    res.json({
      totalComponents: parseInt(totalComponentsResult.rows[0].count),
      totalCategories: parseInt(totalCategoriesResult.rows[0].count),
      totalInventoryItems: parseInt(totalInventoryResult.rows[0].count),
      totalInventoryQuantity: parseInt(totalInventoryResult.rows[0].total_quantity || 0),
      missingFootprints: parseInt(missingFootprintsResult.rows[0].count),
      lowStockAlerts: parseInt(lowStockResult.rows[0].count),
      recentlyAdded: parseInt(recentComponentsResult.rows[0].count)
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
        c.id,
        c.part_number,
        c.description,
        cat.name as category_name,
        c.created_at,
        'component_added' as activity_type
      FROM components c
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      ORDER BY c.created_at DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
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
