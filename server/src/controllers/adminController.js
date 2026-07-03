import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import { logError, logInfo, logWarn } from '../utils/logger.js';

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

/**
 * Execute SQL file statement by statement
 */
const executeSQLFile = async (client, filePath, fileName) => {
  const sql = readFileSync(filePath, 'utf8');
  
  // Better comment removal: preserve newlines, handle inline comments
  const cleanedSQL = sql
    .split('\n')
    .map(line => {
      // Remove everything after -- (single line comments)
      const commentIndex = line.indexOf('--');
      if (commentIndex !== -1) {
        return line.substring(0, commentIndex);
      }
      return line;
    })
    .join('\n');
  
  // Split by semicolons, but be smarter about it
  const statements = [];
  let currentStatement = '';
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < cleanedSQL.length; i++) {
    const char = cleanedSQL[i];
    const prevChar = i > 0 ? cleanedSQL[i - 1] : '';
    
    // Track if we're inside a string literal
    if ((char === "'" || char === '"') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    // Only split on semicolon if not in string
    if (char === ';' && !inString) {
      currentStatement += char;
      const trimmed = currentStatement.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      currentStatement = '';
    } else {
      currentStatement += char;
    }
  }
  
  // Add any remaining statement
  const trimmed = currentStatement.trim();
  if (trimmed.length > 0 && trimmed !== ';') {
    statements.push(trimmed + ';');
  }
  
  let executedCount = 0;
  const errors = [];
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    try {
      await client.query(statement);
      executedCount++;
    } catch (error) {
      const preview = statement.trim().substring(0, 100).replace(/\s+/g, ' ');
      logError('Admin', `[${fileName}] Statement ${i + 1}/${statements.length} FAILED`);
      logError('Admin', `[${fileName}] SQL: ${preview}...`);
      logError('Admin', `[${fileName}] Error: ${error.message}`);
      errors.push({
        statementNumber: i + 1,
        statement: preview + '...',
        error: error.message,
        code: error.code,
      });
    }
  }
  
  logInfo('Admin', `[${fileName}] Summary: ${executedCount}/${statements.length} successful, ${errors.length} failed`);
  
  return { executedCount, errors, totalStatements: statements.length };
};

// Initialize database with full schema
export const initializeDatabase = async (req, res, _next) => {
  const client = await pool.connect();
  
  try {
    logInfo('Admin', 'Starting database initialization...');
    
    // Check if tables already exist
    const tableCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);
    
    const tableCount = parseInt(tableCheck.rows[0].count);
    
    if (tableCount > 0) {
      return res.json({
        success: true,
        message: `Database already initialized with ${tableCount} tables`,
        tableCount: tableCount,
        skipped: true,
      });
    }
    
    // Execute init-schema.sql
    const schemaPath = path.join(__dirname, '../../../database/init-schema.sql');
    logInfo('Admin', 'Loading schema from:', schemaPath);
    
    const result = await executeSQLFile(client, schemaPath, 'init-schema.sql');
    
    // Verify tables were created
    const finalTableCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);
    
    const finalTableCount = parseInt(finalTableCheck.rows[0].count);
    
    res.json({
      success: true,
      message: `Database initialized successfully with ${finalTableCount} tables`,
      tableCount: finalTableCount,
      statementsExecuted: result.executedCount,
      errors: result.errors,
    });
  } catch (error) {
    logError('Admin', 'Database initialization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize database',
      message: error.message,
    });
  } finally {
    client.release();
  }
};

// Reset database (drop all tables and recreate)
export const resetDatabase = async (req, res, _next) => {
  const client = await pool.connect();
  
  try {
    logInfo('Admin', 'Starting database reset...');
    
    // Don't use transaction for schema operations - they're DDL and auto-commit
    // Drop all tables
    await client.query('DROP SCHEMA public CASCADE');
    logInfo('Admin', 'Dropped existing schema');
    
    // Recreate schema
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO postgres');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    logInfo('Admin', 'Created new schema');
    
    // Execute init-schema.sql to recreate tables
    const schemaPath = path.join(__dirname, '../../../database/init-schema.sql');
    const schemaResult = await executeSQLFile(client, schemaPath, 'init-schema.sql');
    logInfo('Admin', `Schema recreated: ${schemaResult.executedCount}/${schemaResult.totalStatements} statements`);
    if (schemaResult.errors.length > 0) {
      logError('Admin', 'Schema errors:', schemaResult.errors);
    }
    
    // Initialize users table
    const usersPath = path.join(__dirname, '../../../database/init-users.sql');
    const usersResult = await executeSQLFile(client, usersPath, 'init-users.sql');
    logInfo('Admin', `Users initialized: ${usersResult.executedCount}/${usersResult.totalStatements} statements`);
    if (usersResult.errors.length > 0) {
      logError('Admin', 'Users initialization errors:', usersResult.errors);
    }
    
    // Verify users table was created
    try {
      const usersCheck = await client.query('SELECT COUNT(*) FROM users');
      logInfo('Admin', `Users table verified: ${usersCheck.rows[0].count} users`);
    } catch (error) {
      logError('Admin', 'Users table verification FAILED:', error.message);
      throw new Error('Users table was not created successfully');
    }

    // Check if there were any errors
    const hasErrors = schemaResult.errors.length > 0 || usersResult.errors.length > 0;

    if (hasErrors) {
      logWarn('Admin', 'Database reset completed with errors:');
      if (schemaResult.errors.length > 0) logWarn('Admin', 'Schema errors:', schemaResult.errors.length);
      if (usersResult.errors.length > 0) logWarn('Admin', 'Users errors:', usersResult.errors.length);
    }

    res.json({
      success: !hasErrors,
      message: hasErrors
        ? 'Database reset completed with errors - check console for details'
        : 'Database reset and reinitialized successfully',
      schema: {
        statementsExecuted: schemaResult.executedCount,
        totalStatements: schemaResult.totalStatements,
        errors: schemaResult.errors,
      },
      users: {
        statementsExecuted: usersResult.executedCount,
        totalStatements: usersResult.totalStatements,
        errors: usersResult.errors,
      },
    });
  } catch (error) {
    logError('Admin', 'Database reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset database',
      message: error.message,
    });
  } finally {
    client.release();
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