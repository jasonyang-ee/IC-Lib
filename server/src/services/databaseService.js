/**
 * Database Service
 * Handles database operations for API calls (silent mode, no user prompts)
 */

import { Client } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database configuration from environment or defaults
const getDbConfig = () => ({
  host: process.env.DB_HOST || 'infra.main.local',
  port: parseInt(process.env.DB_PORT) || 5435,
  user: process.env.DB_USER || 'sami',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'cip',
});

/**
 * Clear all data from tables while preserving schema
 * Default mode for API calls - preserves structure
 */
export const clearDatabaseData = async () => {
  const config = getDbConfig();
  const client = new Client(config);
  const results = {
    success: false,
    message: '',
    clearedTables: [],
    errors: []
  };

  try {
    await client.connect();
    
    // Disable triggers temporarily to avoid cascade issues
    await client.query('SET session_replication_role = replica;');
    
    // Clear main tables in the simplified schema (in reverse dependency order)
    const mainTables = [
      'footprint_sources',
      'inventory',
      'distributor_info',
      'component_specifications',
      'components',
      'component_categories',
      'distributors',
      'manufacturers'
    ];
    
    for (const table of mainTables) {
      try {
        await client.query(`TRUNCATE TABLE ${table} CASCADE`);
        results.clearedTables.push(table);
      } catch (error) {
        // Ignore errors for tables that might not exist
        if (error.code !== '42P01') { // undefined_table error
          results.errors.push({ table, error: error.message });
        }
      }
    }
    
    // Re-enable triggers
    await client.query('SET session_replication_role = DEFAULT;');

    results.success = true;
    results.message = `Successfully cleared ${results.clearedTables.length} tables. Schema and structure preserved.`;
    
  } catch (error) {
    results.success = false;
    results.message = `Database clear failed: ${error.message}`;
    results.errors.push({ general: error.message });
  } finally {
    await client.end();
  }

  return results;
};

/**
 * Full database reset - drops all tables and reinitializes schema
 * Use with caution - this is destructive
 */
export const resetDatabase = async () => {
  const config = getDbConfig();
  const client = new Client(config);
  const results = {
    success: false,
    message: '',
    steps: [],
    errors: []
  };

  try {
    await client.connect();
    results.steps.push('Connected to database');

    // Drop and recreate schema
    await client.query('DROP SCHEMA public CASCADE');
    results.steps.push('Dropped existing schema');
    
    await client.query('CREATE SCHEMA public');
    await client.query(`GRANT ALL ON SCHEMA public TO ${config.user}`);
    await client.query('GRANT ALL ON SCHEMA public TO public');
    results.steps.push('Created new schema');

    // Reinitialize schema from SQL file
    const schemaPath = join(__dirname, '..', '..', '..', 'database', 'schema-simplified.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    await client.query(schema);
    results.steps.push('Reinitialized database schema');

    results.success = true;
    results.message = 'Database reset completed successfully. All tables dropped and schema reinitialized.';
    
  } catch (error) {
    results.success = false;
    results.message = `Database reset failed: ${error.message}`;
    results.errors.push({ general: error.message });
  } finally {
    await client.end();
  }

  return results;
};

/**
 * Initialize database - creates schema if not exists
 */
export const initializeDatabase = async () => {
  const config = getDbConfig();
  const client = new Client(config);
  const results = {
    success: false,
    message: '',
    steps: [],
    tableCount: 0,
    errors: []
  };

  try {
    await client.connect();
    results.steps.push('Connected to database');

    // Check existing tables
    const tableCountResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    const tableCount = parseInt(tableCountResult.rows[0].count);
    console.log(`[initDatabase] Found ${tableCount} existing tables`);

    if (tableCount > 0) {
      results.message = `Database already contains ${tableCount} tables. Use "Clear All Data" or "Full Database Reset" instead.`;
      results.tableCount = tableCount;
      results.success = false;
      console.log('[initDatabase] Aborting - tables already exist');
      return results;
    }

    console.log('[initDatabase] Database is empty, initializing schema...');

    // Load and execute schema
    const schemaPath = join(__dirname, '..', '..', '..', 'database', 'schema-simplified.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    await client.query(schema);
    results.steps.push('Schema initialized successfully');

    // Verify tables
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);

    results.tableCount = tablesResult.rows.length;
    results.success = true;
    results.message = `Database initialized successfully with ${results.tableCount} tables.`;
    console.log(`[initDatabase] Success - created ${results.tableCount} tables`);
    
  } catch (error) {
    results.success = false;
    results.message = `Database initialization failed: ${error.message}`;
    results.errors.push({ general: error.message });
    console.error('[initDatabase] Error:', error);
  } finally {
    await client.end();
  }

  return results;
};

/**
 * Load sample data into the database
 */
export const loadSampleData = async () => {
  const config = getDbConfig();
  const client = new Client(config);
  const results = {
    success: false,
    message: '',
    recordCounts: {},
    errors: []
  };

  try {
    await client.connect();
    
    const sampleDataPath = join(__dirname, '..', '..', '..', 'database', 'sample-data-simplified.sql');
    const sampleData = readFileSync(sampleDataPath, 'utf8');
    
    await client.query(sampleData);
    
    // Get record counts from the new unified schema
    const counts = await client.query(`
      SELECT 'components' as table_name, COUNT(*) as count FROM components
      UNION ALL
      SELECT 'manufacturers', COUNT(*) FROM manufacturers
      UNION ALL
      SELECT 'categories', COUNT(*) FROM component_categories
      UNION ALL
      SELECT 'inventory', COUNT(*) FROM inventory
    `);
    
    counts.rows.forEach(row => {
      results.recordCounts[row.table_name] = parseInt(row.count);
    });
    
    results.success = true;
    results.message = 'Sample data loaded successfully.';
    
  } catch (error) {
    results.success = false;
    results.message = `Failed to load sample data: ${error.message}`;
    results.errors.push({ general: error.message });
  } finally {
    await client.end();
  }

  return results;
};

/**
 * Get database status and statistics
 */
export const getDatabaseStatus = async () => {
  const config = getDbConfig();
  const client = new Client(config);
  const status = {
    connected: false,
    tableCount: 0,
    tables: [],
    recordCounts: {},
    errors: []
  };

  try {
    await client.connect();
    status.connected = true;

    // Get table count
    const tableCountResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    status.tableCount = parseInt(tableCountResult.rows[0].count);

    // Get table names
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    status.tables = tablesResult.rows.map(row => row.tablename);

    // Get record counts for main tables
    if (status.tableCount > 0) {
      try {
        const counts = await client.query(`
          SELECT 'components' as table_name, COUNT(*) as count FROM components
          UNION ALL
          SELECT 'manufacturers', COUNT(*) FROM manufacturers
          UNION ALL
          SELECT 'categories', COUNT(*) FROM component_categories
          UNION ALL
          SELECT 'inventory', COUNT(*) FROM inventory
        `);
        
        counts.rows.forEach(row => {
          status.recordCounts[row.table_name] = parseInt(row.count);
        });
      } catch (error) {
        // Tables might not exist yet
        status.errors.push('Could not fetch record counts');
      }
    }
    
  } catch (error) {
    status.connected = false;
    status.errors.push(error.message);
  } finally {
    if (client) {
      await client.end();
    }
  }

  return status;
};
