import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

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
      console.error(`[${fileName}] Statement ${i + 1}/${statements.length} FAILED`);
      console.error(`[${fileName}] SQL: ${preview}...`);
      console.error(`[${fileName}] Error: ${error.message}`);
      errors.push({
        statementNumber: i + 1,
        statement: preview + '...',
        error: error.message,
        code: error.code,
      });
    }
  }
  
  console.log(`[${fileName}] Summary: ${executedCount}/${statements.length} successful, ${errors.length} failed`);
  
  return { executedCount, errors, totalStatements: statements.length };
};

// Initialize database with full schema
export const initializeDatabase = async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    console.log('Starting database initialization...');
    
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
    console.log('Loading schema from:', schemaPath);
    
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
    console.error('Database initialization error:', error);
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
export const resetDatabase = async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    console.log('Starting database reset...');
    
    // Don't use transaction for schema operations - they're DDL and auto-commit
    // Drop all tables
    await client.query('DROP SCHEMA public CASCADE');
    console.log('Dropped existing schema');
    
    // Recreate schema
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO postgres');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    console.log('Created new schema');
    
    // Execute init-schema.sql to recreate tables
    const schemaPath = path.join(__dirname, '../../../database/init-schema.sql');
    const schemaResult = await executeSQLFile(client, schemaPath, 'init-schema.sql');
    console.log(`Schema recreated: ${schemaResult.executedCount}/${schemaResult.totalStatements} statements`);
    if (schemaResult.errors.length > 0) {
      console.error('Schema errors:', schemaResult.errors);
    }
    
    // Initialize users table
    const usersPath = path.join(__dirname, '../../../database/init-users.sql');
    const usersResult = await executeSQLFile(client, usersPath, 'init-users.sql');
    console.log(`[info] [Admin] Users initialized: ${usersResult.executedCount}/${usersResult.totalStatements} statements`);
    if (usersResult.errors.length > 0) {
      console.error('[error] [Admin] Users initialization errors:', usersResult.errors);
    }
    
    // Verify users table was created
    try {
      const usersCheck = await client.query('SELECT COUNT(*) FROM users');
      console.log(`[info] [Admin] Users table verified: ${usersCheck.rows[0].count} users`);
    } catch (error) {
      console.error('[error] [Admin] Users table verification FAILED:', error.message);
      throw new Error('Users table was not created successfully');
    }
    
    // Load sample data
    const sampleDataPath = path.join(__dirname, '../../../database/init-sample-data.sql');
    const sampleResult = await executeSQLFile(client, sampleDataPath, 'init-sample-data.sql');
    console.log(`[info] [Admin] Sample data loaded: ${sampleResult.executedCount}/${sampleResult.totalStatements} statements`);
    if (sampleResult.errors.length > 0) {
      console.error('[error] [Admin] Sample data errors:', sampleResult.errors);
    }
    
    // Check if users table was created successfully
    const hasErrors = schemaResult.errors.length > 0 || usersResult.errors.length > 0 || sampleResult.errors.length > 0;
    
    if (hasErrors) {
      console.warn('[warn] [Admin] Database reset completed with errors:');
      if (schemaResult.errors.length > 0) console.warn('[warn] [Admin] Schema errors:', schemaResult.errors.length);
      if (usersResult.errors.length > 0) console.warn('[warn] [Admin] Users errors:', usersResult.errors.length);
      if (sampleResult.errors.length > 0) console.warn('[warn] [Admin] Sample data errors:', sampleResult.errors.length);
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
      sampleData: {
        statementsExecuted: sampleResult.executedCount,
        totalStatements: sampleResult.totalStatements,
        errors: sampleResult.errors,
      },
    });
  } catch (error) {
    console.error('Database reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset database',
      message: error.message,
    });
  } finally {
    client.release();
  }
};

// Load sample data
export const loadSampleData = async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    console.log('Loading sample data...');
    
    // Execute init-sample-data.sql
    const sampleDataPath = path.join(__dirname, '../../../database/init-sample-data.sql');
    const result = await executeSQLFile(client, sampleDataPath, 'init-sample-data.sql');
    
    // Get record counts
    const counts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM components) as components,
        (SELECT COUNT(*) FROM manufacturers) as manufacturers,
        (SELECT COUNT(*) FROM component_specifications) as specifications,
        (SELECT COUNT(*) FROM distributor_info) as distributor_info
    `);
    
    res.json({
      success: result.errors.length === 0,
      message: result.errors.length === 0 
        ? `Sample data loaded successfully (${result.executedCount} statements)`
        : `Sample data loaded with ${result.errors.length} errors`,
      statementsExecuted: result.executedCount,
      recordCounts: counts.rows[0],
      errors: result.errors,
    });
  } catch (error) {
    console.error('Load sample data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load sample data',
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
      const requiredTables = [
        'components',
        'component_categories',
        'manufacturers',
        'distributors',
        'component_specifications',
        'distributor_info',
        'inventory',
        'footprint_sources',
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
        message: issues.length === 0 ? 'Database schema is valid' : 'Issues found with database schema',
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};