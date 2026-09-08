import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import { logError, logInfo } from '../utils/logger.js';
import { applyFreshDatabaseMigrations } from '../services/databaseService.js';

// Core-schema quick-verify subset (D11): membership locked to
// EXPECTED_SCHEMA_TABLES by dbTableLists.test.js.
export const VERIFY_CORE_TABLES = [
  'components',
  'component_categories',
  'manufacturers',
  'distributors',
  'component_specification_values',
  'distributor_info',
  'inventory',
  'footprint_sources',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Let PostgreSQL parse complete files, including dollar-quoted functions.
const initializeSchema = async (client) => {
  const results = {};
  for (const [name, file] of [['users', 'init-users.sql'], ['schema', 'init-schema.sql'], ['settings', 'init-settings.sql']]) {
    const sql = readFileSync(path.join(__dirname, '../../../database', file), 'utf8');
    const executed = await client.query(sql);
    const count = Array.isArray(executed) ? executed.length : 1;
    results[name] = { statementsExecuted: count, totalStatements: count, errors: [] };
  }
  await applyFreshDatabaseMigrations(client);
  return results;
};

export const initializeDatabase = async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const existing = await client.query(`SELECT COUNT(*) AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
    const tableCount = Number(existing.rows[0].count);
    if (tableCount > 0) {
      await client.query('ROLLBACK');
      return res.json({ success: true, message: `Database already initialized with ${tableCount} tables`, tableCount, skipped: true });
    }
    const result = await initializeSchema(client);
    const final = await client.query(`SELECT COUNT(*) AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Database initialized successfully', tableCount: Number(final.rows[0].count),
      statementsExecuted: result.schema.statementsExecuted, errors: [] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(rollbackError => logError('Admin', 'Rollback failed:', rollbackError.message));
    logError('Admin', 'Database initialization error:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize database', message: error.message });
  } finally {
    client?.release();
  }
};

export const resetDatabase = async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    // PostgreSQL DDL is transactional: a failed rebuild retains the old schema.
    await client.query('BEGIN');
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    const result = await initializeSchema(client);
    await client.query('COMMIT');
    logInfo('Admin', 'Database reset and reinitialized successfully');
    res.json({ success: true, message: 'Database reset and reinitialized successfully', ...result });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(rollbackError => logError('Admin', 'Rollback failed:', rollbackError.message));
    logError('Admin', 'Database reset error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset database', message: error.message });
  } finally {
    client?.release();
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
        (SELECT COUNT(*) FROM component_specification_values) as total_specifications,
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
      subCategoryBreakdown: subCategoryStats.rows,
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
      for (const tableName of VERIFY_CORE_TABLES) {
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
        message: issues.length === 0 ? 'Database schema is valid' : 'Issues found with database schema',
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};
