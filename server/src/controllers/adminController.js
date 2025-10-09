import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to run Node.js scripts
const runScript = (scriptPath, scriptName) => {
  return new Promise((resolve, reject) => {
    const scriptFullPath = path.join(__dirname, '../../../scripts', scriptPath);
    const childProcess = spawn('node', [scriptFullPath], {
      cwd: path.join(__dirname, '../../../scripts'),
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`[${scriptName}]`, data.toString());
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[${scriptName} ERROR]`, data.toString());
    });

    childProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${scriptName} failed with code ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr, code });
      }
    });

    childProcess.on('error', (error) => {
      reject(new Error(`Failed to start ${scriptName}: ${error.message}`));
    });
  });
};

// Initialize database with full schema
export const initializeDatabase = async (req, res, next) => {
  try {
    console.log('Starting database initialization...');
    const result = await runScript('init-database.js', 'init-database');
    
    res.json({
      success: true,
      message: 'Database initialized successfully',
      output: result.stdout
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize database',
      message: error.message
    });
  }
};

// Reset database (clear all data)
export const resetDatabase = async (req, res, next) => {
  try {
    console.log('Starting database reset...');
    const result = await runScript('reset-database.js', 'reset-database');
    
    res.json({
      success: true,
      message: 'Database reset successfully',
      output: result.stdout
    });
  } catch (error) {
    console.error('Database reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset database',
      message: error.message
    });
  }
};

// Load sample data
export const loadSampleData = async (req, res, next) => {
  try {
    console.log('Loading sample data...');
    
    // Read and execute sample-data.sql
    const fs = await import('fs/promises');
    const sampleDataPath = path.join(__dirname, '../../../database/sample-data.sql');
    const sampleDataSQL = await fs.readFile(sampleDataPath, 'utf8');
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Execute the SQL file
      await client.query(sampleDataSQL);
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Sample data loaded successfully'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Load sample data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load sample data',
      message: error.message
    });
  }
};

// Get database statistics
export const getDatabaseStats = async (req, res, next) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM components) as total_components,
        (SELECT COUNT(*) FROM component_categories) as total_categories,
        (SELECT COUNT(*) FROM manufacturers) as total_manufacturers,
        (SELECT COUNT(*) FROM distributors) as total_distributors,
        (SELECT COUNT(*) FROM component_specifications) as total_specifications
    `);
    
    // Get components per category
    const categoryStats = await pool.query(`
      SELECT 
        cat.name as category_name,
        COUNT(c.id) as component_count
      FROM component_categories cat
      LEFT JOIN components c ON cat.id = c.category_id
      GROUP BY cat.id, cat.name
      ORDER BY cat.name
    `);
    
    res.json({
      summary: stats.rows[0],
      categoryBreakdown: categoryStats.rows
    });
  } catch (error) {
    next(error);
  }
};

// Verify CIS compliance
export const verifyCISCompliance = async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      const issues = [];
      
      // Check if all category tables exist
      const categories = await client.query('SELECT id, name, table_name FROM component_categories');
      
      for (const category of categories.rows) {
        // Check if table exists
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [category.table_name]);
        
        if (!tableCheck.rows[0].exists) {
          issues.push(`Category table ${category.table_name} does not exist`);
        }
      }
      
      // Check if triggers exist
      const requiredTriggers = [
        'sync_to_components_capacitors',
        'sync_to_components_resistors',
        'sync_to_components_ics',
        'sync_to_components_diodes',
        'sync_to_components_inductors',
        'sync_to_components_connectors',
        'sync_to_components_crystals',
        'sync_to_components_relays',
        'sync_to_components_switches',
        'sync_to_components_transformers',
        'sync_to_components_misc'
      ];
      
      for (const triggerName of requiredTriggers) {
        const triggerCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.triggers 
            WHERE trigger_name = $1
          )
        `, [triggerName]);
        
        if (!triggerCheck.rows[0].exists) {
          issues.push(`Trigger ${triggerName} does not exist`);
        }
      }
      
      // Check data consistency
      const consistencyCheck = await client.query(`
        SELECT 
          c.id,
          c.part_number,
          c.category_id,
          cat.table_name
        FROM components c
        JOIN component_categories cat ON c.category_id = cat.id
        LIMIT 5
      `);
      
      res.json({
        compliant: issues.length === 0,
        issues: issues,
        sampleComponents: consistencyCheck.rows,
        message: issues.length === 0 ? 'Database is CIS-compliant' : 'Issues found with CIS compliance'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};
