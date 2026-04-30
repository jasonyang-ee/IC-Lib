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
      console.log('\x1b[33m[WARN]\x1b[0m \x1b[36m[Migration]\x1b[0m No migrations folder found');
      return true;
    }

    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(f => f.endsWith('.sql'))
      .sort(compareMigrationFilenames);

    if (migrationFiles.length === 0) {
      console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[Migration]\x1b[0m No migration files found');
      return true;
    }

    // Run pending migrations
    const pendingMigrations = migrationFiles.filter(filename => !executedMigrations.has(filename));
    let migrationsRun = 0;
    const totalPending = pendingMigrations.length;

    for (const filename of pendingMigrations) {
      console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[Migration]\x1b[0m Applying ${filename} (${migrationsRun + 1}/${totalPending})`);

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
        console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[Migration]\x1b[0m Migration ${filename} completed`);
      } catch (migrationError) {
        await client.query('ROLLBACK');
        console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[Migration]\x1b[0m Migration ${filename} failed: ${migrationError.message}`);
        return false;
      }
    }

    if (migrationsRun > 0) {
      console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[Migration]\x1b[0m ${migrationsRun} migration(s) executed`);
    } else {
      console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[Migration]\x1b[0m All migrations already applied');
    }

    return true;
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[Migration]\x1b[0m Error running migrations: ${error.message}`);
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
    console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[Database]\x1b[0m Initializing parts database schema...');

    // Read the init-schema.sql file
    const sqlFilePath = path.resolve(__dirname, '../../../database/init-schema.sql');

    if (!fs.existsSync(sqlFilePath)) {
      console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[Database]\x1b[0m init-schema.sql file not found at: ${sqlFilePath}`);
      return false;
    }

    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Execute the SQL - wrap in try-catch to handle duplicate trigger/constraint errors
    try {
      await client.query(sql);
      console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[Database]\x1b[0m Parts database schema initialized');
    } catch (initError) {
      const errorMsg = initError.message || '';
      if (errorMsg.includes('already exists') || errorMsg.includes('duplicate') ||
          errorMsg.includes('operator class') || errorMsg.includes('input syntax for type json')) {
        console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[Database]\x1b[0m Parts database schema already exists');
      } else {
        // For other errors, rethrow
        throw initError;
      }
    }

    return true;
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[Database]\x1b[0m Failed to initialize parts database: ${error.message}`);
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
    console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[Database]\x1b[0m Initializing default settings data...');

    const sqlFilePath = path.resolve(__dirname, '../../../database/init-settings.sql');

    if (!fs.existsSync(sqlFilePath)) {
      console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[Database]\x1b[0m init-settings.sql file not found at: ${sqlFilePath}`);
      return false;
    }

    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    await client.query(sql);

    console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[Database]\x1b[0m Default settings data initialized');
    return true;
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[Database]\x1b[0m Failed to initialize default settings data: ${error.message}`);
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
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[AuthService]\x1b[0m Error checking users table: ${error.message}`);
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
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[AuthService]\x1b[0m Error checking activity_types table: ${error.message}`);
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
      console.warn('\x1b[33m[WARN]\x1b[0m \x1b[36m[AuthService]\x1b[0m Users table exists but schema is incomplete');
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      console.warn(`\x1b[33m[WARN]\x1b[0m \x1b[36m[AuthService]\x1b[0m Missing columns: ${missingColumns.join(', ')}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[AuthService]\x1b[0m Error validating users table schema: ${error.message}`);
    return false;
  }
}

/**
 * Initialize users table from SQL file
 */
async function initializeUsersTable() {
  const client = await pool.connect();

  try {
    console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[AuthService]\x1b[0m Initializing users table...');

    // Read the init-users.sql file
    const sqlFilePath = path.resolve(__dirname, '../../../database/init-users.sql');

    if (!fs.existsSync(sqlFilePath)) {
      console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[AuthService]\x1b[0m init-users.sql file not found at: ${sqlFilePath}`);
      return false;
    }

    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Execute the SQL
    await client.query(sql);

    console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[AuthService]\x1b[0m Users table initialized successfully');
    console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[AuthService]\x1b[0m Default admin user created: admin / admin123');
    console.log('\x1b[33m[WARN]\x1b[0m \x1b[36m[AuthService]\x1b[0m IMPORTANT: Change the default password after first login!');

    return true;
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[AuthService]\x1b[0m Failed to initialize users table: ${error.message}`);
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
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[AuthService]\x1b[0m Error checking default admin: ${error.message}`);
    return false;
  }
}

/**
 * Create default admin user if missing
 */
async function createDefaultAdmin() {
  try {
    console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[AuthService]\x1b[0m Creating default admin user...');

    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(`
      INSERT INTO users (username, password_hash, role, is_active)
      VALUES ($1, $2, 'admin', true)
      ON CONFLICT (username) DO NOTHING;
    `, ['admin', hashedPassword]);

    console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[AuthService]\x1b[0m Default admin user created: admin / admin123');
    console.log('\x1b[33m[WARN]\x1b[0m \x1b[36m[AuthService]\x1b[0m Change this password immediately!');

    return true;
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[AuthService]\x1b[0m Failed to create default admin: ${error.message}`);
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
      console.log('\x1b[33m[WARN]\x1b[0m \x1b[36m[AuthService]\x1b[0m activity_types table not found, skipping user activity types');
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
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[AuthService]\x1b[0m Error ensuring user activity types: ${error.message}`);
    return false;
  }
}

/**
 * Main initialization function
 * Runs on server startup to ensure database and authentication are ready
 */
export async function initializeAuthentication() {
  console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[InitService]\x1b[0m Starting database initialization...');

  try {
    // First, check and initialize users table (REQUIRED by parts schema)
    console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[AuthService]\x1b[0m Checking authentication setup...');

    const usersTableExists = await checkUsersTableExists();

    if (!usersTableExists) {
      console.log('\x1b[33m[WARN]\x1b[0m \x1b[36m[AuthService]\x1b[0m Users table not found - initializing from init-users.sql');
      const initialized = await initializeUsersTable();

      if (!initialized) {
        console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[AuthService]\x1b[0m Failed to initialize users table');
        console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[AuthService]\x1b[0m Authentication will not work until this is resolved');
        console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[AuthService]\x1b[0m Please check database/init-users.sql file exists');
        return false;
      }

      // Ensure activity types exist
      await ensureUserActivityTypes();

      console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[AuthService]\x1b[0m Users table initialized successfully');
    } else {
      // Table exists - validate schema
      const schemaValid = await validateUsersTableSchema();

      if (!schemaValid) {
        console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[AuthService]\x1b[0m Users table schema is invalid');
        console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[AuthService]\x1b[0m Please run database/init-users.sql manually or drop the table to auto-recreate');
        return false;
      }

      // Check if default admin exists
      const adminExists = await checkDefaultAdminExists();

      if (!adminExists) {
        console.log('\x1b[33m[WARN]\x1b[0m \x1b[36m[AuthService]\x1b[0m Default admin user not found - creating...');
        await createDefaultAdmin();
      } else {
        console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[AuthService]\x1b[0m Users table found with valid schema');
      }

      // Ensure activity types exist
      await ensureUserActivityTypes();
    }

    console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[AuthService]\x1b[0m Authentication setup verified');

    // Blank databases need base schema before legacy repair migrations.
    console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[Database]\x1b[0m Detecting database state...');
    const isBlankDB = await checkIsBlankDatabase();

    if (isBlankDB) {
      console.log('\x1b[33m[WARN]\x1b[0m \x1b[36m[Database]\x1b[0m Blank database detected - applying init-schema.sql before migrations');

      const initialized = await initializePartsDatabase();

      if (!initialized) {
        console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[Database]\x1b[0m Failed to initialize parts database from init-schema.sql');
        console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[Database]\x1b[0m Core functionality will not work until this is resolved');
        return false;
      }
    }

    console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[Migration]\x1b[0m Checking for pending migrations...');
    const migrationsApplied = await runMigrations();

    if (!migrationsApplied) {
      console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[InitService]\x1b[0m Migrations failed - aborting initialization');
      return false;
    }

    // Run default settings after schema init and migrations to seed missing defaults safely.
    const settingsInitialized = await initializeDefaultSettings();

    if (!settingsInitialized) {
      console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[Database]\x1b[0m Failed to initialize default settings data');
      return false;
    }

    const finalSchemaState = await inspectDatabaseSchema({
      expectedTables: STARTUP_REQUIRED_TABLES,
      expectedViews: EXPECTED_SCHEMA_VIEWS,
      requiredColumns: REPAIRABLE_SCHEMA_COLUMNS,
    });

    if (!finalSchemaState.valid) {
      if (finalSchemaState.missingTables.length > 0) {
        console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[Database]\x1b[0m Missing tables: ${finalSchemaState.missingTables.join(', ')}`);
      }
      if (finalSchemaState.missingViews.length > 0) {
        console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[Database]\x1b[0m Missing views: ${finalSchemaState.missingViews.join(', ')}`);
      }
      if (finalSchemaState.missingColumns.length > 0) {
        const missingColumns = finalSchemaState.missingColumns.map(({ table, column }) => `${table}.${column}`);
        console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[Database]\x1b[0m Missing columns: ${missingColumns.join(', ')}`);
      }
      console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[Database]\x1b[0m Database schema validation failed after all initialization steps');
      return false;
    }

    console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[Database]\x1b[0m Application database schema verified');

    console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[InitService]\x1b[0m Database initialization complete');

    return true;
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[InitService]\x1b[0m Database initialization failed: ${error.message}`);
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[InitService]\x1b[0m Server will start but functionality may be limited');
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
      console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[Database]\x1b[0m Blank database detected (migration table present, no application tables)');
    } else {
      console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[Database]\x1b[0m Blank database detected (no tables found)');
    }
    return true;
  }

  console.log('\x1b[32m[INFO]\x1b[0m \x1b[36m[Database]\x1b[0m Existing database detected');
  return false;
}

/**
 * Get authentication status for health checks
 */
export async function getAuthenticationStatus() {
  try {
    const usersTableExists = await checkUsersTableExists();
    const schemaValid = usersTableExists ? await validateUsersTableSchema() : false;
    const adminExists = usersTableExists ? await checkDefaultAdminExists() : false;

    return {
      usersTableExists,
      schemaValid,
      defaultAdminExists: adminExists,
      ready: usersTableExists && schemaValid && adminExists,
    };
  } catch (error) {
    return {
      usersTableExists: false,
      schemaValid: false,
      defaultAdminExists: false,
      ready: false,
      error: error.message,
    };
  }
}
