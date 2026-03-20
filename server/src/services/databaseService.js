/**
 * Database Service
 * Handles database operations for API calls (silent mode, no user prompts)
 */

import { Client } from 'pg';
import { readFileSync, readdirSync, unlinkSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Split SQL content into individual statements
 * Handles multi-line statements and comments properly
 */
const _splitSQLStatements = (sql) => {
  // Remove comments
  const withoutComments = sql.replace(/--[^\n]*\n/g, '\n');
  
  // Split by semicolons but preserve them
  const statements = withoutComments
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0)
    .map(stmt => stmt + ';');
  
  return statements;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database configuration from environment or defaults
const getDbConfig = () => ({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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
    errors: [],
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
      'component_specification_values',
      'components',
      'component_categories',
      'distributors',
      'manufacturers',
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
    errors: [],
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

    // Initialize users table FIRST (required by schema foreign keys)
    const usersPath = join(__dirname, '..', '..', '..', 'database', 'init-users.sql');
    const usersSql = readFileSync(usersPath, 'utf8');
    
    await client.query(usersSql);
    results.steps.push('Initialized users table with default admin account');

    // Reinitialize schema from SQL file (references users table)
    const schemaPath = join(__dirname, '..', '..', '..', 'database', 'init-schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    // Execute schema as single query (schema file is designed for this)
    await client.query(schema);
    results.steps.push('Reinitialized database schema');

    // Initialize default settings data (categories, distributors, specs, ECO defaults)
    const settingsPath = join(__dirname, '..', '..', '..', 'database', 'init-settings.sql');
    const settingsSql = readFileSync(settingsPath, 'utf8');
    await client.query(settingsSql);
    results.steps.push('Initialized default distributors, ECO defaults, and specifications');

    // Wipe categories so the user starts with a clean slate
    await client.query('TRUNCATE component_categories CASCADE');
    results.steps.push('Cleared category configurations');

    results.success = true;
    results.message = 'Database reset completed successfully. All tables dropped and schema reinitialized with default admin user.';
    
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
    errors: [],
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

    // Initialize users table FIRST (required by schema foreign keys)
    const usersPath = join(__dirname, '..', '..', '..', 'database', 'init-users.sql');
    const usersSql = readFileSync(usersPath, 'utf8');
    
    await client.query(usersSql);
    results.steps.push('Initialized users table with default admin account');

    // Load and execute schema (references users table)
    const schemaPath = join(__dirname, '..', '..', '..', 'database', 'init-schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    await client.query(schema);
    results.steps.push('Schema initialized successfully');

    // Initialize default settings data (categories, distributors, specs, ECO defaults)
    const settingsPath = join(__dirname, '..', '..', '..', 'database', 'init-settings.sql');
    const settingsSql = readFileSync(settingsPath, 'utf8');
    await client.query(settingsSql);
    results.steps.push('Initialized default categories, distributors, and specifications');

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
    errors: [],
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
      } catch {
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

/**
 * Initialize default settings (categories, distributors, specs, ECO defaults)
 * Safe to run repeatedly — all INSERTs use ON CONFLICT DO NOTHING
 */
export const initSettings = async () => {
  const config = getDbConfig();
  const client = new Client(config);
  const results = {
    success: false,
    message: '',
    steps: [],
    errors: [],
  };

  try {
    await client.connect();
    results.steps.push('Connected to database');

    const settingsPath = join(__dirname, '..', '..', '..', 'database', 'init-settings.sql');
    const settingsSql = readFileSync(settingsPath, 'utf8');
    await client.query(settingsSql);
    results.steps.push('Initialized default categories, distributors, specifications, and ECO defaults');

    results.success = true;
    results.message = 'Default settings initialized successfully. Existing data was preserved (ON CONFLICT DO NOTHING).';
  } catch (error) {
    results.success = false;
    results.message = `Settings initialization failed: ${error.message}`;
    results.errors.push({ general: error.message });
  } finally {
    await client.end();
  }

  return results;
};

/**
 * Delete parts and project data only — preserves categories, specs, users, settings
 * Targets: components (+ cascades), eco_orders (+ cascades), activity_log, projects, cad_files, footprint_sources
 */
export const deletePartsAndProjectData = async () => {
  const config = getDbConfig();
  const client = new Client(config);
  const results = {
    success: false,
    message: '',
    clearedTables: [],
    errors: [],
  };

  try {
    await client.connect();

    // Disable triggers temporarily to avoid cascade issues
    await client.query('SET session_replication_role = replica;');

    // Tables to truncate — order matters for cascade relationships
    // These are ONLY parts/project data tables, NOT settings/config tables
    const tablesToClear = [
      'eco_orders',            // cascades: eco_changes, eco_distributors, eco_alternative_parts, eco_specifications, eco_stage_approvers, eco_approvals
      'activity_log',
      'projects',              // cascades: project_components
      'footprint_sources',
      'cad_files',             // cascades: component_cad_files
      'components',            // cascades: inventory, inventory_alternative, distributor_info, component_specification_values, components_alternative, component_cad_files
    ];

    for (const table of tablesToClear) {
      try {
        await client.query(`TRUNCATE TABLE ${table} CASCADE`);
        results.clearedTables.push(table);
      } catch (error) {
        if (error.code !== '42P01') { // undefined_table error
          results.errors.push({ table, error: error.message });
        }
      }
    }

    // Re-enable triggers
    await client.query('SET session_replication_role = DEFAULT;');

    // Reset ECO numbering back to 1
    await client.query('UPDATE eco_settings SET next_number = 1');

    results.success = true;
    results.message = `Successfully cleared ${results.clearedTables.length} tables. Categories, specifications, users, and settings preserved.`;
  } catch (error) {
    results.success = false;
    results.message = `Delete parts data failed: ${error.message}`;
    results.errors.push({ general: error.message });
  } finally {
    await client.end();
  }

  return results;
};

/**
 * Delete all library files from disk and clear CAD file tracking in database
 * Clears: library/footprint/, library/symbol/, library/model/, library/pspice/, library/pad/
 * Does NOT touch: library/temp/
 */
export const deleteLibraryFiles = async () => {
  const config = getDbConfig();
  const client = new Client(config);
  const results = {
    success: false,
    message: '',
    deletedFiles: 0,
    errors: [],
  };

  try {
    // Delete files from library subdirectories
    const libraryBase = join(__dirname, '..', '..', '..', 'library');
    const subDirs = ['footprint', 'symbol', 'model', 'pspice', 'pad'];

    for (const subDir of subDirs) {
      const dirPath = join(libraryBase, subDir);
      if (!existsSync(dirPath)) continue;

      try {
        const files = readdirSync(dirPath);
        for (const file of files) {
          try {
            unlinkSync(join(dirPath, file));
            results.deletedFiles++;
          } catch (fileError) {
            results.errors.push({ file: `${subDir}/${file}`, error: fileError.message });
          }
        }
      } catch (dirError) {
        results.errors.push({ directory: subDir, error: dirError.message });
      }
    }

    // Clear CAD file tracking in database
    await client.connect();
    await client.query('TRUNCATE TABLE cad_files CASCADE');
    // Reset component TEXT columns to empty
    await client.query("UPDATE components SET pcb_footprint = '', schematic = '', step_model = '', pspice = '', pad_file = ''");

    results.success = true;
    results.message = `Deleted ${results.deletedFiles} library files and cleared CAD file tracking.`;
  } catch (error) {
    results.success = false;
    results.message = `Delete library files failed: ${error.message}`;
    results.errors.push({ general: error.message });
  } finally {
    await client.end();
  }

  return results;
};

/**
 * Delete all user records except admin and guest
 * Preserves activity log entries (user_id set to NULL via ON DELETE SET NULL)
 */
export const deleteUserRecords = async () => {
  const config = getDbConfig();
  const client = new Client(config);
  const results = {
    success: false,
    message: '',
    deletedCount: 0,
    errors: [],
  };

  try {
    await client.connect();

    const result = await client.query(
      "DELETE FROM users WHERE username NOT IN ('admin', 'guest') RETURNING username",
    );

    results.deletedCount = result.rowCount;
    results.success = true;
    results.message = `Deleted ${results.deletedCount} user(s). Admin and guest accounts preserved.`;
  } catch (error) {
    results.success = false;
    results.message = `Delete user records failed: ${error.message}`;
    results.errors.push({ general: error.message });
  } finally {
    await client.end();
  }

  return results;
};
