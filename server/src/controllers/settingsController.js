import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as databaseService from '../services/databaseService.js';

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
