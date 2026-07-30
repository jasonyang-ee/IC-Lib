import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  EXPECTED_SCHEMA_VIEWS,
  REPAIRABLE_SCHEMA_COLUMNS,
  STARTUP_REQUIRED_TABLES,
  inspectDatabaseSchema,
} from './schemaInspectionService.js';
import {
  compareMigrationFilenames,
  parseMigrationFilename,
} from './migrationNaming.js';
import { logError, logInfo, logWarn } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run all pending migrations from the migrations folder
 */
async function runMigrations() {
  const client = await pool.connect();

  try {
    // Create or upgrade the migrations tracking table.
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        sequence_number INTEGER,
        description TEXT,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS sequence_number INTEGER');
    await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS description TEXT');
    await client.query('ALTER TABLE schema_migrations DROP COLUMN IF EXISTS version_tag');

    await client.query(`
      DELETE FROM schema_migrations versioned
      USING schema_migrations numeric
      WHERE versioned.filename ~ '^v[^_]+_[0-9]+_.+\\.sql$'
        AND numeric.filename = regexp_replace(versioned.filename, '^v[^_]+_', '')
    `);

    await client.query(`
      UPDATE schema_migrations
      SET filename = regexp_replace(filename, '^v[^_]+_', '')
      WHERE filename ~ '^v[^_]+_[0-9]+_.+\\.sql$'
    `);

    await client.query(`
      WITH parsed_migrations AS (
        SELECT
          id,
          regexp_match(filename, '^([0-9]+)_(.+)\\.sql$') AS parts
        FROM schema_migrations
        WHERE filename ~ '^[0-9]+_.+\\.sql$'
      )
      UPDATE schema_migrations sm
      SET sequence_number = parsed_migrations.parts[1]::INTEGER,
          description = replace(parsed_migrations.parts[2], '_', ' ')
      FROM parsed_migrations
      WHERE sm.id = parsed_migrations.id
        AND (sm.sequence_number IS NULL OR sm.description IS NULL)
    `);

    // Get list of already executed migrations
    const executedResult = await client.query('SELECT filename FROM schema_migrations');
    const executedMigrations = new Set(executedResult.rows.map(r => r.filename));

    // Get all migration files
    const migrationsPath = path.resolve(__dirname, '../../../database/migrations');

    if (!fs.existsSync(migrationsPath)) {
      logWarn('Migration', 'No migrations folder found');
      return true;
    }

    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(f => f.endsWith('.sql'))
      .sort(compareMigrationFilenames);

    if (migrationFiles.length === 0) {
      logInfo('Migration', 'No migration files found');
      return true;
    }

    // Run pending migrations
    const pendingMigrations = migrationFiles.filter(filename => !executedMigrations.has(filename));
    let migrationsRun = 0;
    const totalPending = pendingMigrations.length;
    const alreadyApplied = migrationFiles.length - totalPending;
    const executedMigrationNames = [];

    logInfo('Migration', `${migrationFiles.length} migration file(s) found; ${alreadyApplied} already applied, ${totalPending} pending`);

    if (totalPending > 0) {
      logInfo('Migration', `Pending migrations: ${pendingMigrations.join(', ')}`);
    }

    for (const filename of pendingMigrations) {
      logInfo('Migration', `Applying ${filename} (${migrationsRun + 1}/${totalPending})`);

      const filePath = path.join(migrationsPath, filename);
      const sql = fs.readFileSync(filePath, 'utf8');
      const migrationMetadata = parseMigrationFilename(filename);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, sequence_number, description) VALUES ($1, $2, $3)',
          [
            filename,
            migrationMetadata.sequenceNumber,
            migrationMetadata.description,
          ],
        );
        await client.query('COMMIT');

        migrationsRun++;
        executedMigrationNames.push(filename);
        logInfo('Migration', `Migration ${filename} completed (${migrationsRun}/${totalPending})`);
      } catch (migrationError) {
        await client.query('ROLLBACK');
        logError('Migration', `Migration ${filename} failed: ${migrationError.message}`);
        return false;
      }
    }

    if (migrationsRun > 0) {
      logInfo('Migration', `Executed migrations: ${executedMigrationNames.join(', ')}`);
      logInfo('Migration', `${migrationsRun} migration(s) executed`);
    } else {
      logInfo('Migration', 'All migrations already applied');
    }

    return true;
  } catch (error) {
    logError('Migration', `Error running migrations: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Initialize main parts database from init-schema.sql
 */
async function initializePartsDatabase() {
  const client = await pool.connect();

  try {
    logInfo('Database', 'Initializing parts database schema...');

    // Read the init-schema.sql file
    const sqlFilePath = path.resolve(__dirname, '../../../database/init-schema.sql');

    if (!fs.existsSync(sqlFilePath)) {
      logError('Database', `init-schema.sql file not found at: ${sqlFilePath}`);
      return false;
    }

    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Execute the SQL - wrap in try-catch to handle duplicate trigger/constraint errors
    try {
      await client.query(sql);
      logInfo('Database', 'Parts database schema initialized');
    } catch (initError) {
      const errorMsg = initError.message || '';
      if (errorMsg.includes('already exists') || errorMsg.includes('duplicate') ||
          errorMsg.includes('operator class') || errorMsg.includes('input syntax for type json')) {
        logInfo('Database', 'Parts database schema already exists');
      } else {
        // For other errors, rethrow
        throw initError;
      }
    }

    return true;
  } catch (error) {
    logError('Database', `Failed to initialize parts database: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Initialize default settings data from init-settings.sql
 */
async function initializeDefaultSettings() {
  const client = await pool.connect();

  try {
    logInfo('Database', 'Seeding default settings (idempotent, ON CONFLICT DO NOTHING)...');

    const sqlFilePath = path.resolve(__dirname, '../../../database/init-settings.sql');

    if (!fs.existsSync(sqlFilePath)) {
      logError('Database', `init-settings.sql file not found at: ${sqlFilePath}`);
      return false;
    }

    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    await client.query(sql);

    logInfo('Database', 'Default settings data initialized');
    return true;
  } catch (error) {
    logError('Database', `Failed to initialize default settings data: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Check if users table exists
 */
async function checkUsersTableExists() {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      );
    `);
    return result.rows[0].exists;
  } catch (error) {
    logError('AuthService', `Error checking users table: ${error.message}`);
    return false;
  }
}

/**
 * Check if activity_types table exists
 */
async function checkActivityTypesTableExists() {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'activity_types'
      );
    `);
    return result.rows[0].exists;
  } catch (error) {
    logError('AuthService', `Error checking activity_types table: ${error.message}`);
    return false;
  }
}

/**
 * Validate users table schema
 */
async function validateUsersTableSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);

    const requiredColumns = [
      'id', 'username', 'password_hash', 'role',
      'created_by', 'last_login', 'is_active',
    ];

    const existingColumns = result.rows.map(row => row.column_name);
    const hasAllColumns = requiredColumns.every(col => existingColumns.includes(col));

    if (!hasAllColumns) {
      logWarn('AuthService', 'Users table exists but schema is incomplete');
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      logWarn('AuthService', `Missing columns: ${missingColumns.join(', ')}`);
      return false;
    }

    return true;
  } catch (error) {
    logError('AuthService', `Error validating users table schema: ${error.message}`);
    return false;
  }
}

/**
 * Initialize users table from SQL file
 */
async function initializeUsersTable() {
  const client = await pool.connect();

  try {
    logInfo('AuthService', 'Initializing users table...');

    // Read the init-users.sql file
    const sqlFilePath = path.resolve(__dirname, '../../../database/init-users.sql');

    if (!fs.existsSync(sqlFilePath)) {
      logError('AuthService', `init-users.sql file not found at: ${sqlFilePath}`);
      return false;
    }

    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Execute the SQL
    await client.query(sql);

    logInfo('AuthService', 'Users table initialized successfully');
    logInfo('AuthService', 'Default admin user created: admin / admin123');
    logWarn('AuthService', 'IMPORTANT: Change the default password after first login!');

    return true;
  } catch (error) {
    logError('AuthService', `Failed to initialize users table: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Check if default admin user exists
 */
async function checkDefaultAdminExists() {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM users WHERE username = 'admin'
      );
    `);
    return result.rows[0].exists;
  } catch (error) {
    logError('AuthService', `Error checking default admin: ${error.message}`);
    return false;
  }
}

/**
 * Create default admin user if missing
 */
async function createDefaultAdmin() {
  try {
    logInfo('AuthService', 'Creating default admin user...');

    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(`
      INSERT INTO users (username, password_hash, role, is_active)
      VALUES ($1, $2, 'admin', true)
      ON CONFLICT (username) DO NOTHING;
    `, ['admin', hashedPassword]);

    logInfo('AuthService', 'Default admin user created: admin / admin123');
    logWarn('AuthService', 'Change this password immediately!');

    return true;
  } catch (error) {
    logError('AuthService', `Failed to create default admin: ${error.message}`);
    return false;
  }
}

/**
 * Ensure user-related activity types exist
 */
async function ensureUserActivityTypes() {
  try {
    const hasActivityTypes = await checkActivityTypesTableExists();

    if (!hasActivityTypes) {
      logWarn('AuthService', 'activity_types table not found, skipping user activity types');
      return true;
    }

    await pool.query(`
      INSERT INTO activity_types (type_name, description)
      VALUES
        ('user_created', 'New user account created'),
        ('user_updated', 'User account updated'),
        ('user_deleted', 'User account deleted'),
        ('user_login', 'User logged in'),
        ('user_logout', 'User logged out')
      ON CONFLICT (type_name) DO NOTHING;
    `);

    return true;
  } catch (error) {
    logError('AuthService', `Error ensuring user activity types: ${error.message}`);
    return false;
  }
}

/**
 * Main initialization function
 * Runs on server startup to ensure database and authentication are ready
 */
export async function initializeAuthentication() {
  logInfo('InitService', 'Starting database initialization...');

  try {
    // First, check and initialize users table (REQUIRED by parts schema)
    logInfo('AuthService', 'Checking authentication setup...');

    const usersTableExists = await checkUsersTableExists();

    if (!usersTableExists) {
      logWarn('AuthService', 'Users table not found - initializing from init-users.sql');
      const initialized = await initializeUsersTable();

      if (!initialized) {
        logError('AuthService', 'Failed to initialize users table');
        logError('AuthService', 'Authentication will not work until this is resolved');
        logError('AuthService', 'Please check database/init-users.sql file exists');
        return false;
      }

      // Ensure activity types exist
      await ensureUserActivityTypes();

      logInfo('AuthService', 'Users table initialized successfully');
    } else {
      // Table exists - validate schema
      const schemaValid = await validateUsersTableSchema();

      if (!schemaValid) {
        logError('AuthService', 'Users table schema is invalid');
        logError('AuthService', 'Please run database/init-users.sql manually or drop the table to auto-recreate');
        return false;
      }

      // Check if default admin exists
      const adminExists = await checkDefaultAdminExists();

      if (!adminExists) {
        logWarn('AuthService', 'Default admin user not found - creating...');
        await createDefaultAdmin();
      } else {
        logInfo('AuthService', 'Users table found with valid schema');
      }

      // Ensure activity types exist
      await ensureUserActivityTypes();
    }

    logInfo('AuthService', 'Authentication setup verified');

    // Blank databases need base schema before legacy repair migrations.
    logInfo('Database', 'Detecting database state...');
    const isBlankDB = await checkIsBlankDatabase();

    if (isBlankDB) {
      logWarn('Database', 'Blank database -> running init-schema.sql, then migrations');

      const initialized = await initializePartsDatabase();

      if (!initialized) {
        logError('Database', 'Failed to initialize parts database from init-schema.sql');
        logError('Database', 'Core functionality will not work until this is resolved');
        return false;
      }
    } else {
      logInfo('Database', 'Existing database -> skipping init-schema, applying migrations only');
    }

    logInfo('Migration', 'Checking for pending migrations...');
    const migrationsApplied = await runMigrations();

    if (!migrationsApplied) {
      logError('InitService', 'Migrations failed - aborting initialization');
      return false;
    }

    // Run default settings after schema init and migrations to seed missing defaults safely.
    const settingsInitialized = await initializeDefaultSettings();

    if (!settingsInitialized) {
      logError('Database', 'Failed to initialize default settings data');
      return false;
    }

    const finalSchemaState = await inspectDatabaseSchema({
      expectedTables: STARTUP_REQUIRED_TABLES,
      expectedViews: EXPECTED_SCHEMA_VIEWS,
      requiredColumns: REPAIRABLE_SCHEMA_COLUMNS,
    });

    if (!finalSchemaState.valid) {
      if (finalSchemaState.missingTables.length > 0) {
        logError('Database', `Missing tables: ${finalSchemaState.missingTables.join(', ')}`);
      }
      if (finalSchemaState.missingViews.length > 0) {
        logError('Database', `Missing views: ${finalSchemaState.missingViews.join(', ')}`);
      }
      if (finalSchemaState.missingColumns.length > 0) {
        const missingColumns = finalSchemaState.missingColumns.map(({ table, column }) => `${table}.${column}`);
        logError('Database', `Missing columns: ${missingColumns.join(', ')}`);
      }
      logError('Database', 'Database schema validation failed after all initialization steps');
      return false;
    }

    logInfo('Database', 'Application database schema verified');

    logInfo('InitService', 'Database initialization complete');

    return true;
  } catch (error) {
    logError('InitService', `Database initialization failed: ${error.message}`);
    logError('InitService', 'Server will start but functionality may be limited');
    return false;
  }
}

/**
 * Check if the database is blank by looking for critical base tables.
 * Returns true if none of the core app tables exist yet (blank DB).
 */
async function checkIsBlankDatabase() {
  const criticalTables = [
    'component_categories',
    'manufacturers',
    'distributors',
    'components',
  ];

  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name = ANY($1::text[])
  `, [criticalTables]);

  const existingCriticalTables = new Set(result.rows.map(row => row.table_name));

  const foundCount = criticalTables.filter(t => existingCriticalTables.has(t)).length;

  if (foundCount === 0) {
    // Check if this is a truly blank DB or a DB with just migration tracking
    const migrationResult = await pool.query(`
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'schema_migrations'
    `);

    const hasMigrationTable = parseInt(migrationResult.rows[0].count) > 0;

    if (hasMigrationTable) {
      // Migration table exists but no critical tables = fresh DB before migrations ran
      logInfo('Database', 'Blank database detected (migration table present, no application tables)');
    } else {
      logInfo('Database', 'Blank database detected (no tables found)');
    }
    return true;
  }

  logInfo('Database', 'Existing database detected');
  return false;
}

