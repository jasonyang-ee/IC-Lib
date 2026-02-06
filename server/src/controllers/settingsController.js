import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as databaseService from '../services/databaseService.js';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to settings file - relative to project root
// In development: server/src/controllers -> ../../../config/settings.json
// In Docker: /app/server/src/controllers -> ../../../config/settings.json (project copied to /app)
const SETTINGS_FILE = path.join(__dirname, '../../../config/settings.json');

// Default settings structure
const DEFAULT_SETTINGS = {
  partNumberConfigs: {},
};

/**
 * Ensure settings file exists with default values
 */
const ensureSettingsFile = async () => {
  try {
    await fs.access(SETTINGS_FILE);
  } catch {
    // File doesn't exist, create it with defaults
    const dir = path.dirname(SETTINGS_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
  }
};

/**
 * Read settings from file
 */
const readSettings = async () => {
  await ensureSettingsFile();
  const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
  return JSON.parse(data);
};

/**
 * Write settings to file
 */
const writeSettings = async (settings) => {
  await ensureSettingsFile();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
};

/**
 * GET /api/settings - Get all application settings
 */
export const getSettings = async (req, res) => {
  try {
    const settings = await readSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({ 
      error: 'Failed to read settings',
      message: error.message, 
    });
  }
};

/**
 * PUT /api/settings - Update application settings
 * Body can contain partial settings to update
 */
export const updateSettings = async (req, res) => {
  try {
    const currentSettings = await readSettings();
    
    // Merge new settings with existing ones
    const updatedSettings = {
      ...currentSettings,
      ...req.body,
      // Handle nested partNumberConfigs merge
      partNumberConfigs: {
        ...currentSettings.partNumberConfigs,
        ...(req.body.partNumberConfigs || {}),
      },
    };

    await writeSettings(updatedSettings);
    
    res.json({
      success: true,
      settings: updatedSettings,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ 
      error: 'Failed to update settings',
      message: error.message, 
    });
  }
};

/**
 * GET /api/settings/database/status - Get database status
 */
export const getDatabaseStatus = async (req, res) => {
  try {
    const status = await databaseService.getDatabaseStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting database status:', error);
    res.status(500).json({ 
      error: 'Failed to get database status',
      message: error.message, 
    });
  }
};

/**
 * POST /api/settings/database/clear - Clear all data (preserve schema)
 * This is the default safe option for API calls
 */
export const clearDatabase = async (req, res) => {
  try {
    console.log('Starting database clear (data only)...');
    const results = await databaseService.clearDatabaseData();
    
    if (results.success) {
      res.json({
        success: true,
        message: results.message,
        clearedTables: results.clearedTables,
        errors: results.errors,
      });
    } else {
      res.status(500).json({
        success: false,
        message: results.message,
        errors: results.errors,
      });
    }
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ 
      error: 'Failed to clear database',
      message: error.message, 
    });
  }
};

/**
 * POST /api/settings/database/reset - Full database reset (drop and recreate)
 * Requires confirmation parameter for safety
 */
export const resetDatabase = async (req, res) => {
  try {
    // Require explicit confirmation for full reset
    if (req.body.confirm !== true) {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'Full database reset requires { "confirm": true } in request body',
      });
    }

    console.log('Starting full database reset...');
    const results = await databaseService.resetDatabase();
    
    if (results.success) {
      res.json({
        success: true,
        message: results.message,
        steps: results.steps,
        errors: results.errors,
      });
    } else {
      res.status(500).json({
        success: false,
        message: results.message,
        errors: results.errors,
      });
    }
  } catch (error) {
    console.error('Error resetting database:', error);
    res.status(500).json({ 
      error: 'Failed to reset database',
      message: error.message, 
    });
  }
};

/**
 * POST /api/settings/database/sample-data - Load sample data
 */
export const loadSampleData = async (req, res) => {
  try {
    console.log('Loading sample data...');
    const results = await databaseService.loadSampleData();
    
    if (results.success) {
      res.json({
        success: true,
        message: results.message,
        recordCounts: results.recordCounts,
      });
    } else {
      res.status(500).json({
        success: false,
        message: results.message,
        errors: results.errors,
      });
    }
  } catch (error) {
    console.error('Error loading sample data:', error);
    res.status(500).json({ 
      error: 'Failed to load sample data',
      message: error.message, 
    });
  }
};

/**
 * GET /api/settings/database/verify - Verify database schema
 */
export const verifyDatabase = async (req, res) => {
  try {
    console.log('Verifying database schema...');
    
    // Expected tables for the redesigned schema
    const expectedTables = [
      'users',
      'component_categories',
      'manufacturers',
      'distributors',
      'components',
      'components_alternative',
      'category_specifications',
      'component_specification_values',
      'distributor_info',
      'inventory',
      'inventory_alternative',
      'footprint_sources',
      'schema_version',
      'activity_log',
      'activity_types',
      'user_activity_log',
      'projects',
      'project_components',
      'eco_settings',
      'eco_orders',
      'eco_changes',
      'eco_distributors',
      'eco_alternative_parts',
      'eco_specifications',
      'eco_approval_stages',
      'eco_stage_approvers',
      'eco_approvals',
      'smtp_settings',
      'email_notification_preferences',
      'email_log',
    ];
    
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    const existingTables = result.rows.map(row => row.tablename);
    const missingTables = expectedTables.filter(t => !existingTables.includes(t));
    const extraTables = existingTables.filter(t => !expectedTables.includes(t));
    
    const valid = missingTables.length === 0;
    
    res.json({
      valid,
      message: valid ? 'Database schema is valid' : 'Database schema has issues',
      expectedTables,
      existingTables,
      missingTables,
      extraTables,
      issues: valid ? [] : [
        ...missingTables.map(t => `Missing table: ${t}`),
        ...extraTables.map(t => `Unexpected table: ${t}`),
      ],
    });
  } catch (error) {
    console.error('Error verifying database:', error);
    res.status(500).json({ 
      error: 'Failed to verify database',
      message: error.message, 
    });
  }
};

/**
 * GET /api/settings/categories - Get all component categories with configuration
 */
export const getCategoryConfigs = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        name,
        prefix,
        leading_zeros,
        display_order
      FROM component_categories
      ORDER BY display_order, name
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching category configs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch category configurations',
      message: error.message, 
    });
  }
};

/**
 * PUT /api/settings/categories/:id - Update category configuration
 * Automatically updates all part numbers when prefix or leading_zeros changes
 */
export const updateCategoryConfig = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { prefix, leading_zeros } = req.body;

    // Validate inputs
    if (prefix !== undefined && (typeof prefix !== 'string' || prefix.length === 0)) {
      return res.status(400).json({ error: 'Invalid prefix: must be a non-empty string' });
    }
    
    if (leading_zeros !== undefined && (typeof leading_zeros !== 'number' || leading_zeros < 1 || leading_zeros > 10)) {
      return res.status(400).json({ error: 'Invalid leading_zeros: must be a number between 1 and 10' });
    }

    if (prefix === undefined && leading_zeros === undefined) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    await client.query('BEGIN');

    // Get current category configuration
    const currentResult = await client.query(
      'SELECT id, name, prefix, leading_zeros FROM component_categories WHERE id = $1',
      [id],
    );

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Category not found' });
    }

    const currentCategory = currentResult.rows[0];
    const oldPrefix = currentCategory.prefix;
    const oldLeadingZeros = currentCategory.leading_zeros || 5;
    const newPrefix = prefix !== undefined ? prefix : oldPrefix;
    const newLeadingZeros = leading_zeros !== undefined ? leading_zeros : oldLeadingZeros;

    const prefixChanged = newPrefix !== oldPrefix;
    const leadingZerosChanged = newLeadingZeros !== oldLeadingZeros;

    // If prefix or leading_zeros changed, we need to update all part numbers
    const updatedComponents = [];
    if (prefixChanged || leadingZerosChanged) {
      console.log(`\x1b[33m[INFO]\x1b[0m \x1b[36m[SettingsController]\x1b[0m Category ${currentCategory.name}: prefix ${oldPrefix} -> ${newPrefix}, leading_zeros ${oldLeadingZeros} -> ${newLeadingZeros}`);

      // Get all components in this category, ordered by their current numeric value
      const componentsResult = await client.query(
        'SELECT id, part_number FROM components WHERE category_id = $1 ORDER BY part_number',
        [id],
      );

      for (const comp of componentsResult.rows) {
        // Extract the numeric part from the current part number
        const match = comp.part_number.match(new RegExp(`^${oldPrefix}-(\\d+)$`));
        if (match) {
          const numericPart = parseInt(match[1], 10);
          const paddedNumber = String(numericPart).padStart(newLeadingZeros, '0');
          const newPartNumber = `${newPrefix}-${paddedNumber}`;

          // Update the component's part number
          await client.query(
            'UPDATE components SET part_number = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newPartNumber, comp.id],
          );

          // Note: No need to update components_alternative - they reference component_id (UUID)
          // which doesn't change when part_number changes.

          updatedComponents.push({
            old_part_number: comp.part_number,
            new_part_number: newPartNumber,
          });
        }
      }

      console.log(`\x1b[32m[SUCCESS]\x1b[0m \x1b[36m[SettingsController]\x1b[0m Updated ${updatedComponents.length} part numbers for category ${currentCategory.name}`);
    }

    // Update the category configuration
    await client.query(
      'UPDATE component_categories SET prefix = $1, leading_zeros = $2 WHERE id = $3',
      [newPrefix, newLeadingZeros, id],
    );

    // Log activity if parts were updated
    if (updatedComponents.length > 0) {
      await client.query(`
        INSERT INTO user_activity_log (type_name, description, user_id)
        VALUES ('category_config_updated', $1, $2)
      `, [
        `Updated category ${currentCategory.name}: prefix ${oldPrefix} -> ${newPrefix}, leading_zeros ${oldLeadingZeros} -> ${newLeadingZeros}, updated ${updatedComponents.length} part numbers`,
        req.user?.userId || null,
      ]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      category: {
        id,
        name: currentCategory.name,
        prefix: newPrefix,
        leading_zeros: newLeadingZeros,
      },
      prefix_changed: prefixChanged,
      leading_zeros_changed: leadingZerosChanged,
      updated_part_count: updatedComponents.length,
      updated_parts: updatedComponents.length > 0 ? updatedComponents.slice(0, 10) : [], // Return first 10 as sample
      message: updatedComponents.length > 0 
        ? `Updated ${updatedComponents.length} part numbers` 
        : 'Category updated, no part numbers needed updating',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[SettingsController]\x1b[0m Error updating category config: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to update category configuration',
      message: error.message, 
    });
  } finally {
    client.release();
  }
};

/**
 * POST /api/settings/categories - Create new category
 */
export const createCategory = async (req, res) => {
  try {
    const { name, prefix, leading_zeros } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    if (!prefix || typeof prefix !== 'string' || prefix.trim().length === 0) {
      return res.status(400).json({ error: 'Category prefix is required' });
    }

    const validLeadingZeros = leading_zeros !== undefined ? leading_zeros : 5;

    // Validate types
    if (typeof validLeadingZeros !== 'number' || validLeadingZeros < 1 || validLeadingZeros > 10) {
      return res.status(400).json({ error: 'Invalid leading_zeros: must be a number between 1 and 10' });
    }

    // Get the maximum display_order to append new category at the end
    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(display_order), 0) as max_order FROM component_categories',
    );
    const nextDisplayOrder = maxOrderResult.rows[0].max_order + 1;

    const result = await pool.query(`
      INSERT INTO component_categories (name, prefix, leading_zeros, display_order)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, prefix, leading_zeros, display_order
    `, [name.trim(), prefix.trim(), validLeadingZeros, nextDisplayOrder]);

    res.status(201).json({
      success: true,
      category: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating category:', error);
    
    // Handle unique constraint violations
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: 'Category with this name or prefix already exists',
        message: error.message, 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create category',
      message: error.message, 
    });
  }
};

/**
 * PUT /api/settings/categories/reorder - Update display order for multiple categories
 */
export const updateCategoryOrder = async (req, res) => {
  try {
    const { categories } = req.body; // Array of { id, display_order }

    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: 'Categories array is required' });
    }

    // Update each category's display order
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const category of categories) {
        await client.query(
          'UPDATE component_categories SET display_order = $1 WHERE id = $2',
          [category.display_order, category.id],
        );
      }

      await client.query('COMMIT');
      res.json({ success: true, message: 'Category order updated successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating category order:', error);
    res.status(500).json({ 
      error: 'Failed to update category order',
      message: error.message, 
    });
  }
};

/**
 * GET /api/settings/categories/:categoryId/specifications
 * Get all specifications for a specific category
 */
export const getCategorySpecifications = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        id,
        category_id,
        spec_name,
        unit,
        mapping_spec_names,
        display_order,
        is_required,
        updated_at
      FROM category_specifications
      WHERE category_id = $1
      ORDER BY display_order ASC, spec_name ASC
    `, [categoryId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching category specifications:', error);
    res.status(500).json({ 
      error: 'Failed to fetch category specifications',
      message: error.message, 
    });
  }
};

/**
 * POST /api/settings/categories/:categoryId/specifications
 * Create a new specification for a category
 */
export const createCategorySpecification = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { spec_name, unit, mapping_spec_names, display_order, is_required } = req.body;
    
    if (!spec_name || spec_name.trim() === '') {
      return res.status(400).json({ error: 'spec_name is required' });
    }
    
    // Ensure mapping_spec_names is an array, default to empty array
    const mappings = Array.isArray(mapping_spec_names) ? mapping_spec_names : [];
    
    const result = await pool.query(`
      INSERT INTO category_specifications 
        (category_id, spec_name, unit, mapping_spec_names, display_order, is_required)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      categoryId, 
      spec_name.trim(), 
      unit || null, 
      JSON.stringify(mappings),
      display_order || 0, 
      is_required || false,
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating category specification:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: 'This specification already exists for this category', 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create category specification',
      message: error.message, 
    });
  }
};

/**
 * PUT /api/settings/specifications/:id
 * Update a category specification
 */
export const updateCategorySpecification = async (req, res) => {
  try {
    const { id } = req.params;
    const { spec_name, unit, mapping_spec_names, display_order, is_required } = req.body;
    
    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (spec_name !== undefined) {
      updates.push(`spec_name = $${paramCount++}`);
      values.push(spec_name);
    }
    if (unit !== undefined) {
      updates.push(`unit = $${paramCount++}`);
      values.push(unit);
    }
    if (mapping_spec_names !== undefined) {
      updates.push(`mapping_spec_names = $${paramCount++}`);
      values.push(JSON.stringify(Array.isArray(mapping_spec_names) ? mapping_spec_names : []));
    }
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramCount++}`);
      values.push(display_order);
    }
    if (is_required !== undefined) {
      updates.push(`is_required = $${paramCount++}`);
      values.push(is_required);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const result = await pool.query(`
      UPDATE category_specifications
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating category specification:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: 'A specification with this name already exists for this category', 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update category specification',
      message: error.message, 
    });
  }
};

/**
 * DELETE /api/settings/specifications/:id
 * Delete a category specification (will cascade delete all component values)
 */
export const deleteCategorySpecification = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      DELETE FROM category_specifications
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Specification deleted successfully',
      deleted: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting category specification:', error);
    res.status(500).json({ 
      error: 'Failed to delete category specification',
      message: error.message, 
    });
  }
};

/**
 * PUT /api/settings/categories/:categoryId/specifications/reorder
 * Batch update display order for specifications
 */
export const reorderCategorySpecifications = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { specifications } = req.body; // Array of {id, display_order}
    
    if (!Array.isArray(specifications)) {
      return res.status(400).json({ error: 'specifications must be an array' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const spec of specifications) {
        await client.query(`
          UPDATE category_specifications
          SET display_order = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND category_id = $3
        `, [spec.display_order, spec.id, categoryId]);
      }
      
      await client.query('COMMIT');
      
      // Return updated list
      const result = await client.query(`
        SELECT * FROM category_specifications
        WHERE category_id = $1
        ORDER BY display_order ASC, spec_name ASC
      `, [categoryId]);
      
      res.json(result.rows);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error reordering category specifications:', error);
    res.status(500).json({ 
      error: 'Failed to reorder specifications',
      message: error.message, 
    });
  }
};

// Sync components to inventory (create missing inventory entries)
export const syncComponentsToInventory = async (req, res) => {
  try {
    const result = await pool.query(`
      INSERT INTO inventory (component_id, quantity, minimum_quantity, location)
      SELECT 
        c.id,
        0,
        0,
        NULL
      FROM components c
      WHERE NOT EXISTS (
        SELECT 1 FROM inventory i WHERE i.component_id = c.id
      )
      ON CONFLICT (component_id) DO NOTHING
      RETURNING *
    `);

    res.json({ 
      message: 'Components synced to inventory successfully',
      created: result.rows.length,
      entries: result.rows,
    });
  } catch (error) {
    console.error('Error syncing components to inventory:', error);
    res.status(500).json({ 
      error: 'Failed to sync components to inventory',
      message: error.message, 
    });
  }
};

// ============================================================================
// Export/Import Settings Functions
// ============================================================================

/**
 * POST /api/settings/export
 * Export all admin settings including users, categories, and specifications
 */
export const exportAllSettings = async (req, res) => {
  try {
    // Get all users (excluding password hashes)
    const usersResult = await pool.query(`
      SELECT 
        username, 
        role, 
        is_active,
        created_at
      FROM users
      ORDER BY username
    `);

    // Get all categories
    const categoriesResult = await pool.query(`
      SELECT 
        id,
        name,
        prefix,
        leading_zeros,
        display_order
      FROM component_categories
      ORDER BY display_order, name
    `);

    // Get all category specifications
    const specificationsResult = await pool.query(`
      SELECT 
        cs.id,
        cs.category_id,
        cc.name as category_name,
        cs.spec_name,
        cs.unit,
        cs.mapping_spec_names,
        cs.display_order,
        cs.is_required
      FROM category_specifications cs
      JOIN component_categories cc ON cs.category_id = cc.id
      ORDER BY cc.display_order, cs.display_order
    `);

    // Get application settings
    const settings = await readSettings();

    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.username || 'unknown',
      data: {
        users: usersResult.rows,
        categories: categoriesResult.rows.map(cat => ({
          ...cat,
          specifications: specificationsResult.rows
            .filter(spec => spec.category_id === cat.id)
            .map(({ category_id: _category_id, category_name: _category_name, ...spec }) => spec),
        })),
        settings: settings,
      },
    };

    res.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    console.error('Error exporting settings:', error);
    res.status(500).json({ 
      error: 'Failed to export settings',
      message: error.message, 
    });
  }
};

/**
 * POST /api/settings/import
 * Import admin settings - overwrites existing data
 * Specs not in import will be deleted from database
 */
export const importAllSettings = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Import data is required' });
    }

    const results = {
      users: { created: 0, updated: 0, deactivated: 0, errors: [] },
      categories: { created: 0, updated: 0, errors: [] },
      specifications: { created: 0, updated: 0, deleted: 0, errors: [] },
      settings: { updated: false },
    };

    await client.query('BEGIN');

    // ============================================================
    // Step 1: Import Users
    // ============================================================
    if (data.users && Array.isArray(data.users)) {
      const importedUsernames = new Set(data.users.map(u => u.username));
      
      for (const user of data.users) {
        if (!user.username || !user.role) {
          results.users.errors.push(`Invalid user data: ${JSON.stringify(user)}`);
          continue;
        }

        try {
          // Check if user exists
          const existing = await client.query(
            'SELECT id FROM users WHERE username = $1',
            [user.username],
          );

          if (existing.rows.length > 0) {
            // Update existing user (don't change password)
            await client.query(`
              UPDATE users 
              SET role = $1, is_active = $2
              WHERE username = $3
            `, [user.role, user.is_active !== false, user.username]);
            results.users.updated++;
          } else {
            // Create new user with default password (they should change it)
            const bcrypt = await import('bcryptjs');
            const defaultPasswordHash = await bcrypt.hash('changeme123', 10);
            
            await client.query(`
              INSERT INTO users (username, password_hash, role, is_active, created_by)
              VALUES ($1, $2, $3, $4, $5)
            `, [user.username, defaultPasswordHash, user.role, user.is_active !== false, req.user?.userId]);
            results.users.created++;
          }
        } catch (userError) {
          results.users.errors.push(`User ${user.username}: ${userError.message}`);
        }
      }

      // Deactivate users not in import (except admin to prevent lockout)
      const existingUsers = await client.query(
        'SELECT username FROM users WHERE username != $1',
        ['admin'],
      );
      
      for (const existingUser of existingUsers.rows) {
        if (!importedUsernames.has(existingUser.username)) {
          await client.query(
            'UPDATE users SET is_active = false WHERE username = $1',
            [existingUser.username],
          );
          results.users.deactivated++;
        }
      }
    }

    // ============================================================
    // Step 2: Import Categories and Specifications
    // ============================================================
    if (data.categories && Array.isArray(data.categories)) {
      const importedCategoryIds = new Set();
      const categoryNameToId = new Map();

      for (const category of data.categories) {
        if (!category.name || !category.prefix) {
          results.categories.errors.push(`Invalid category data: ${JSON.stringify(category)}`);
          continue;
        }

        try {
          // Check if category exists by name
          const existing = await client.query(
            'SELECT id FROM component_categories WHERE name = $1',
            [category.name],
          );

          let categoryId;

          if (existing.rows.length > 0) {
            // Update existing category
            categoryId = existing.rows[0].id;
            await client.query(`
              UPDATE component_categories 
              SET prefix = $1, leading_zeros = $2, display_order = $3
              WHERE id = $4
            `, [category.prefix, category.leading_zeros || 5, category.display_order || 0, categoryId]);
            results.categories.updated++;
          } else {
            // Create new category
            const newCat = await client.query(`
              INSERT INTO component_categories (name, prefix, leading_zeros, display_order)
              VALUES ($1, $2, $3, $4)
              RETURNING id
            `, [category.name, category.prefix, category.leading_zeros || 5, category.display_order || 0]);
            categoryId = newCat.rows[0].id;
            results.categories.created++;
          }

          importedCategoryIds.add(categoryId);
          categoryNameToId.set(category.name, categoryId);

          // ============================================================
          // Step 3: Import Specifications for this category
          // ============================================================
          if (category.specifications && Array.isArray(category.specifications)) {
            const importedSpecNames = new Set();

            for (const spec of category.specifications) {
              if (!spec.spec_name) continue;
              
              importedSpecNames.add(spec.spec_name);

              try {
                // Check if spec exists
                const existingSpec = await client.query(
                  'SELECT id FROM category_specifications WHERE category_id = $1 AND spec_name = $2',
                  [categoryId, spec.spec_name],
                );

                if (existingSpec.rows.length > 0) {
                  // Update existing spec
                  await client.query(`
                    UPDATE category_specifications 
                    SET unit = $1, mapping_spec_names = $2, display_order = $3, is_required = $4, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $5
                  `, [
                    spec.unit || null,
                    JSON.stringify(spec.mapping_spec_names || []),
                    spec.display_order || 0,
                    spec.is_required || false,
                    existingSpec.rows[0].id,
                  ]);
                  results.specifications.updated++;
                } else {
                  // Create new spec
                  await client.query(`
                    INSERT INTO category_specifications (category_id, spec_name, unit, mapping_spec_names, display_order, is_required)
                    VALUES ($1, $2, $3, $4, $5, $6)
                  `, [
                    categoryId,
                    spec.spec_name,
                    spec.unit || null,
                    JSON.stringify(spec.mapping_spec_names || []),
                    spec.display_order || 0,
                    spec.is_required || false,
                  ]);
                  results.specifications.created++;
                }
              } catch (specError) {
                results.specifications.errors.push(`Spec ${spec.spec_name}: ${specError.message}`);
              }
            }

            // Delete specs not in import for this category
            const existingSpecs = await client.query(
              'SELECT id, spec_name FROM category_specifications WHERE category_id = $1',
              [categoryId],
            );

            for (const existingSpec of existingSpecs.rows) {
              if (!importedSpecNames.has(existingSpec.spec_name)) {
                // Delete spec and its values (cascade)
                await client.query(
                  'DELETE FROM category_specifications WHERE id = $1',
                  [existingSpec.id],
                );
                results.specifications.deleted++;
              }
            }
          }
        } catch (catError) {
          results.categories.errors.push(`Category ${category.name}: ${catError.message}`);
        }
      }
    }

    // ============================================================
    // Step 4: Import Application Settings
    // ============================================================
    if (data.settings) {
      try {
        await writeSettings(data.settings);
        results.settings.updated = true;
      } catch (settingsError) {
        console.error('Error updating settings:', settingsError);
      }
    }

    await client.query('COMMIT');

    // Log activity
    try {
      await pool.query(
        `INSERT INTO user_activity_log (type_name, description, user_id)
         VALUES ('settings_import', $1, $2)`,
        [
          `Imported settings: ${results.users.created + results.users.updated} users, ${results.categories.created + results.categories.updated} categories, ${results.specifications.created + results.specifications.updated} specs`,
          req.user?.userId,
        ],
      );
    } catch (logError) {
      console.error('Failed to log settings import:', logError);
    }

    res.json({
      success: true,
      message: 'Settings imported successfully',
      results,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing settings:', error);
    res.status(500).json({ 
      error: 'Failed to import settings',
      message: error.message, 
    });
  } finally {
    client.release();
  }
};

/**
 * POST /api/settings/export/users
 * Export only users
 */
export const exportUsers = async (req, res) => {
  try {
    const usersResult = await pool.query(`
      SELECT 
        username, 
        role, 
        is_active,
        created_at
      FROM users
      ORDER BY username
    `);

    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.username || 'unknown',
      users: usersResult.rows,
    };

    res.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    console.error('Error exporting users:', error);
    res.status(500).json({ 
      error: 'Failed to export users',
      message: error.message, 
    });
  }
};

/**
 * POST /api/settings/import/users
 * Import only users - overwrites existing
 */
export const importUsers = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { users } = req.body;
    
    if (!users || !Array.isArray(users)) {
      return res.status(400).json({ error: 'Users array is required' });
    }

    const results = { created: 0, updated: 0, deactivated: 0, errors: [] };
    const importedUsernames = new Set(users.map(u => u.username));

    await client.query('BEGIN');

    for (const user of users) {
      if (!user.username || !user.role) {
        results.errors.push(`Invalid user data: ${JSON.stringify(user)}`);
        continue;
      }

      try {
        const existing = await client.query(
          'SELECT id FROM users WHERE username = $1',
          [user.username],
        );

        if (existing.rows.length > 0) {
          await client.query(`
            UPDATE users 
            SET role = $1, is_active = $2
            WHERE username = $3
          `, [user.role, user.is_active !== false, user.username]);
          results.updated++;
        } else {
          const bcrypt = await import('bcryptjs');
          const defaultPasswordHash = await bcrypt.hash('changeme123', 10);
          
          await client.query(`
            INSERT INTO users (username, password_hash, role, is_active, created_by)
            VALUES ($1, $2, $3, $4, $5)
          `, [user.username, defaultPasswordHash, user.role, user.is_active !== false, req.user?.userId]);
          results.created++;
        }
      } catch (userError) {
        results.errors.push(`User ${user.username}: ${userError.message}`);
      }
    }

    // Deactivate users not in import (except admin)
    const existingUsers = await client.query(
      'SELECT username FROM users WHERE username != $1',
      ['admin'],
    );
    
    for (const existingUser of existingUsers.rows) {
      if (!importedUsernames.has(existingUser.username)) {
        await client.query(
          'UPDATE users SET is_active = false WHERE username = $1',
          [existingUser.username],
        );
        results.deactivated++;
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Users imported successfully',
      results,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing users:', error);
    res.status(500).json({ 
      error: 'Failed to import users',
      message: error.message, 
    });
  } finally {
    client.release();
  }
};

/**
 * POST /api/settings/export/categories
 * Export categories with specifications
 */
export const exportCategories = async (req, res) => {
  try {
    const categoriesResult = await pool.query(`
      SELECT 
        id,
        name,
        prefix,
        leading_zeros,
        display_order
      FROM component_categories
      ORDER BY display_order, name
    `);

    const specificationsResult = await pool.query(`
      SELECT 
        cs.id,
        cs.category_id,
        cc.name as category_name,
        cs.spec_name,
        cs.unit,
        cs.mapping_spec_names,
        cs.display_order,
        cs.is_required
      FROM category_specifications cs
      JOIN component_categories cc ON cs.category_id = cc.id
      ORDER BY cc.display_order, cs.display_order
    `);

    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.username || 'unknown',
      categories: categoriesResult.rows.map(cat => ({
        name: cat.name,
        prefix: cat.prefix,
        leading_zeros: cat.leading_zeros,
        display_order: cat.display_order,
        specifications: specificationsResult.rows
          .filter(spec => spec.category_id === cat.id)
          .map(({ id: _id, category_id: _category_id, category_name: _category_name, ...spec }) => spec),
      })),
    };

    res.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    console.error('Error exporting categories:', error);
    res.status(500).json({ 
      error: 'Failed to export categories',
      message: error.message, 
    });
  }
};

/**
 * POST /api/settings/import/categories
 * Import categories with specifications - overwrites existing, deletes missing specs
 */
export const importCategories = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { categories } = req.body;
    
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({ error: 'Categories array is required' });
    }

    const results = {
      categories: { created: 0, updated: 0, errors: [] },
      specifications: { created: 0, updated: 0, deleted: 0, errors: [] },
    };

    await client.query('BEGIN');

    for (const category of categories) {
      if (!category.name || !category.prefix) {
        results.categories.errors.push(`Invalid category data: ${JSON.stringify(category)}`);
        continue;
      }

      try {
        const existing = await client.query(
          'SELECT id FROM component_categories WHERE name = $1',
          [category.name],
        );

        let categoryId;

        if (existing.rows.length > 0) {
          categoryId = existing.rows[0].id;
          await client.query(`
            UPDATE component_categories 
            SET prefix = $1, leading_zeros = $2, display_order = $3
            WHERE id = $4
          `, [category.prefix, category.leading_zeros || 5, category.display_order || 0, categoryId]);
          results.categories.updated++;
        } else {
          const newCat = await client.query(`
            INSERT INTO component_categories (name, prefix, leading_zeros, display_order)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `, [category.name, category.prefix, category.leading_zeros || 5, category.display_order || 0]);
          categoryId = newCat.rows[0].id;
          results.categories.created++;
        }

        // Process specifications
        if (category.specifications && Array.isArray(category.specifications)) {
          const importedSpecNames = new Set();

          for (const spec of category.specifications) {
            if (!spec.spec_name) continue;
            
            importedSpecNames.add(spec.spec_name);

            try {
              const existingSpec = await client.query(
                'SELECT id FROM category_specifications WHERE category_id = $1 AND spec_name = $2',
                [categoryId, spec.spec_name],
              );

              if (existingSpec.rows.length > 0) {
                await client.query(`
                  UPDATE category_specifications 
                  SET unit = $1, mapping_spec_names = $2, display_order = $3, is_required = $4, updated_at = CURRENT_TIMESTAMP
                  WHERE id = $5
                `, [
                  spec.unit || null,
                  JSON.stringify(spec.mapping_spec_names || []),
                  spec.display_order || 0,
                  spec.is_required || false,
                  existingSpec.rows[0].id,
                ]);
                results.specifications.updated++;
              } else {
                await client.query(`
                  INSERT INTO category_specifications (category_id, spec_name, unit, mapping_spec_names, display_order, is_required)
                  VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                  categoryId,
                  spec.spec_name,
                  spec.unit || null,
                  JSON.stringify(spec.mapping_spec_names || []),
                  spec.display_order || 0,
                  spec.is_required || false,
                ]);
                results.specifications.created++;
              }
            } catch (specError) {
              results.specifications.errors.push(`Spec ${spec.spec_name}: ${specError.message}`);
            }
          }

          // Delete specs not in import
          const existingSpecs = await client.query(
            'SELECT id, spec_name FROM category_specifications WHERE category_id = $1',
            [categoryId],
          );

          for (const existingSpec of existingSpecs.rows) {
            if (!importedSpecNames.has(existingSpec.spec_name)) {
              await client.query(
                'DELETE FROM category_specifications WHERE id = $1',
                [existingSpec.id],
              );
              results.specifications.deleted++;
            }
          }
        }
      } catch (catError) {
        results.categories.errors.push(`Category ${category.name}: ${catError.message}`);
      }
    }

    await client.query('COMMIT');

    // Log activity
    try {
      await pool.query(
        `INSERT INTO user_activity_log (type_name, description, user_id)
         VALUES ('categories_import', $1, $2)`,
        [
          `Imported: ${results.categories.created + results.categories.updated} categories, ${results.specifications.created + results.specifications.updated} specs created/updated, ${results.specifications.deleted} specs deleted`,
          req.user?.userId,
        ],
      );
    } catch (logError) {
      console.error('Failed to log categories import:', logError);
    }

    res.json({
      success: true,
      message: 'Categories imported successfully',
      results,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing categories:', error);
    res.status(500).json({ 
      error: 'Failed to import categories',
      message: error.message, 
    });
  } finally {
    client.release();
  }
};

/**
 * GET /api/settings/eco - Get ECO settings
 */
export const getECOSettings = async (req, res) => {
  try {
    // Ensure eco_settings table exists and has data
    const result = await pool.query('SELECT * FROM eco_settings LIMIT 1');
    
    if (result.rows.length === 0) {
      // Initialize with default values
      const initResult = await pool.query(`
        INSERT INTO eco_settings (prefix, leading_zeros, next_number)
        VALUES ('ECO-', 6, 1)
        RETURNING *
      `);
      return res.json(initResult.rows[0]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching ECO settings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch ECO settings',
      message: error.message, 
    });
  }
};

/**
 * PUT /api/settings/eco - Update ECO settings
 */
export const updateECOSettings = async (req, res) => {
  try {
    const { prefix, leading_zeros, next_number } = req.body;
    
    // Validate inputs
    if (prefix !== undefined && (typeof prefix !== 'string' || prefix.length > 20)) {
      return res.status(400).json({ error: 'Prefix must be a string with max 20 characters' });
    }
    
    if (leading_zeros !== undefined && (typeof leading_zeros !== 'number' || leading_zeros < 1 || leading_zeros > 10)) {
      return res.status(400).json({ error: 'Leading zeros must be a number between 1 and 10' });
    }
    
    if (next_number !== undefined && (typeof next_number !== 'number' || next_number < 1)) {
      return res.status(400).json({ error: 'Next number must be a positive number' });
    }
    
    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (prefix !== undefined) {
      updates.push(`prefix = $${paramIndex++}`);
      values.push(prefix);
    }
    
    if (leading_zeros !== undefined) {
      updates.push(`leading_zeros = $${paramIndex++}`);
      values.push(leading_zeros);
    }
    
    if (next_number !== undefined) {
      updates.push(`next_number = $${paramIndex++}`);
      values.push(next_number);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    const result = await pool.query(`
      UPDATE eco_settings
      SET ${updates.join(', ')}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      // Table exists but no row - insert a new one
      const insertResult = await pool.query(`
        INSERT INTO eco_settings (prefix, leading_zeros, next_number)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [prefix || 'ECO-', leading_zeros || 6, next_number || 1]);
      return res.json(insertResult.rows[0]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating ECO settings:', error);
    res.status(500).json({ 
      error: 'Failed to update ECO settings',
      message: error.message, 
    });
  }
};

/**
 * GET /api/settings/eco/preview - Preview what the next ECO number would look like
 */
export const previewECONumber = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM eco_settings LIMIT 1');
    
    if (result.rows.length === 0) {
      return res.json({ preview: 'ECO-000001' });
    }
    
    const settings = result.rows[0];
    const preview = settings.prefix + settings.next_number.toString().padStart(settings.leading_zeros, '0');
    
    res.json({ preview });
  } catch (error) {
    console.error('Error previewing ECO number:', error);
    res.status(500).json({ 
      error: 'Failed to preview ECO number',
      message: error.message, 
    });
  }
};
