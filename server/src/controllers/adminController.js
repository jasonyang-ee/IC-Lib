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
    
    // Read and execute sample-data-simplified.sql
    const fs = await import('fs/promises');
    const sampleDataPath = path.join(__dirname, '../../../database/sample-data-simplified.sql');
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
        (SELECT COUNT(*) FROM component_categories WHERE enabled = true) as total_categories,
        (SELECT COUNT(*) FROM manufacturers) as total_manufacturers,
        (SELECT COUNT(*) FROM distributors) as total_distributors,
        (SELECT COUNT(*) FROM component_specifications) as total_specifications,
        (SELECT COUNT(*) FROM distributor_info) as total_distributor_info,
        (SELECT COUNT(*) FROM inventory) as total_inventory_records
    `);
    
    // Get components per category
    const categoryStats = await pool.query(`
      SELECT 
        cat.name as category_name,
        cat.prefix as category_prefix,
        COUNT(c.id) as component_count
      FROM component_categories cat
      LEFT JOIN components c ON cat.id = c.category_id
      WHERE cat.enabled = true
      GROUP BY cat.id, cat.name, cat.prefix
      ORDER BY cat.name
    `);
    
    // Get components by sub-category
    const subCategoryStats = await pool.query(`
      SELECT 
        cat.name as category_name,
        c.sub_category1,
        COUNT(c.id) as component_count
      FROM components c
      JOIN component_categories cat ON c.category_id = cat.id
      WHERE c.sub_category1 IS NOT NULL
      GROUP BY cat.name, c.sub_category1
      ORDER BY cat.name, c.sub_category1
      LIMIT 20
    `);
    
    res.json({
      summary: stats.rows[0],
      categoryBreakdown: categoryStats.rows,
      subCategoryBreakdown: subCategoryStats.rows
    });
  } catch (error) {
    next(error);
  }
};

// Verify database schema (replaces CIS compliance check)
export const verifyDatabaseSchema = async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      const issues = [];
      
      // Check required tables exist
      const requiredTables = [
        'components',
        'component_categories',
        'manufacturers',
        'distributors',
        'component_specifications',
        'distributor_info',
        'inventory',
        'footprint_sources'
      ];
      
      for (const tableName of requiredTables) {
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [tableName]);
        
        if (!tableCheck.rows[0].exists) {
          issues.push(`Required table ${tableName} does not exist`);
        }
      }
      
      // Check for generated column (part_type)
      const columnCheck = await client.query(`
        SELECT column_name, is_generated
        FROM information_schema.columns
        WHERE table_name = 'components' 
        AND column_name = 'part_type'
      `);
      
      if (columnCheck.rows.length === 0) {
        issues.push('Generated column part_type not found in components table');
      }
      
      // Check data integrity
      const integrityCheck = await client.query(`
        SELECT 
          COUNT(*) as total_components,
          COUNT(DISTINCT category_id) as unique_categories,
          COUNT(DISTINCT manufacturer_id) as unique_manufacturers
        FROM components
      `);
      
      res.json({
        valid: issues.length === 0,
        issues: issues,
        integrity: integrityCheck.rows[0],
        message: issues.length === 0 ? 'Database schema is valid' : 'Issues found with database schema'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};

// Keep old CIS function for backward compatibility (deprecated)
export const verifyCISCompliance = async (req, res, next) => {
  return verifyDatabaseSchema(req, res, next);
};
