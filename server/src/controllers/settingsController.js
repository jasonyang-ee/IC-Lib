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
  partNumberConfigs: {}
};

/**
 * Ensure settings file exists with default values
 */
const ensureSettingsFile = async () => {
  try {
    await fs.access(SETTINGS_FILE);
  } catch (error) {
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
      message: error.message 
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
        ...(req.body.partNumberConfigs || {})
      }
    };

    await writeSettings(updatedSettings);
    
    res.json({
      success: true,
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ 
      error: 'Failed to update settings',
      message: error.message 
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
      message: error.message 
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
        errors: results.errors
      });
    } else {
      res.status(500).json({
        success: false,
        message: results.message,
        errors: results.errors
      });
    }
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ 
      error: 'Failed to clear database',
      message: error.message 
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
        message: 'Full database reset requires { "confirm": true } in request body'
      });
    }

    console.log('Starting full database reset...');
    const results = await databaseService.resetDatabase();
    
    if (results.success) {
      res.json({
        success: true,
        message: results.message,
        steps: results.steps,
        errors: results.errors
      });
    } else {
      res.status(500).json({
        success: false,
        message: results.message,
        errors: results.errors
      });
    }
  } catch (error) {
    console.error('Error resetting database:', error);
    res.status(500).json({ 
      error: 'Failed to reset database',
      message: error.message 
    });
  }
};

/**
 * POST /api/settings/database/init - Initialize database
 */
export const initDatabase = async (req, res) => {
  try {
    console.log('Initializing database...');
    const results = await databaseService.initializeDatabase();
    
    if (results.success) {
      res.json({
        success: true,
        message: results.message,
        tableCount: results.tableCount,
        steps: results.steps
      });
    } else {
      res.status(400).json({
        success: false,
        message: results.message,
        tableCount: results.tableCount,
        errors: results.errors
      });
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    res.status(500).json({ 
      error: 'Failed to initialize database',
      message: error.message 
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
        recordCounts: results.recordCounts
      });
    } else {
      res.status(500).json({
        success: false,
        message: results.message,
        errors: results.errors
      });
    }
  } catch (error) {
    console.error('Error loading sample data:', error);
    res.status(500).json({ 
      error: 'Failed to load sample data',
      message: error.message 
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
        enabled,
        created_at,
        updated_at
      FROM component_categories
      ORDER BY name
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching category configs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch category configurations',
      message: error.message 
    });
  }
};

/**
 * PUT /api/settings/categories/:id - Update category configuration
 */
export const updateCategoryConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { prefix, leading_zeros, enabled } = req.body;

    // Validate inputs
    if (prefix !== undefined && (typeof prefix !== 'string' || prefix.length === 0)) {
      return res.status(400).json({ error: 'Invalid prefix: must be a non-empty string' });
    }
    
    if (leading_zeros !== undefined && (typeof leading_zeros !== 'number' || leading_zeros < 1 || leading_zeros > 10)) {
      return res.status(400).json({ error: 'Invalid leading_zeros: must be a number between 1 and 10' });
    }
    
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid enabled: must be a boolean' });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (prefix !== undefined) {
      updates.push(`prefix = $${paramCount}`);
      values.push(prefix);
      paramCount++;
    }
    
    if (leading_zeros !== undefined) {
      updates.push(`leading_zeros = $${paramCount}`);
      values.push(leading_zeros);
      paramCount++;
    }
    
    if (enabled !== undefined) {
      updates.push(`enabled = $${paramCount}`);
      values.push(enabled);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(`
      UPDATE component_categories
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, prefix, leading_zeros, enabled, created_at, updated_at
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({
      success: true,
      category: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating category config:', error);
    res.status(500).json({ 
      error: 'Failed to update category configuration',
      message: error.message 
    });
  }
};

/**
 * POST /api/settings/categories - Create new category
 */
export const createCategory = async (req, res) => {
  try {
    const { name, prefix, leading_zeros, enabled } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    if (!prefix || typeof prefix !== 'string' || prefix.trim().length === 0) {
      return res.status(400).json({ error: 'Category prefix is required' });
    }

    const validLeadingZeros = leading_zeros !== undefined ? leading_zeros : 5;
    const validEnabled = enabled !== undefined ? enabled : true;

    // Validate types
    if (typeof validLeadingZeros !== 'number' || validLeadingZeros < 1 || validLeadingZeros > 10) {
      return res.status(400).json({ error: 'Invalid leading_zeros: must be a number between 1 and 10' });
    }

    const result = await pool.query(`
      INSERT INTO component_categories (name, prefix, leading_zeros, enabled)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, prefix, leading_zeros, enabled, created_at, updated_at
    `, [name.trim(), prefix.trim(), validLeadingZeros, validEnabled]);

    res.status(201).json({
      success: true,
      category: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating category:', error);
    
    // Handle unique constraint violations
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: 'Category with this name or prefix already exists',
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create category',
      message: error.message 
    });
  }
};
