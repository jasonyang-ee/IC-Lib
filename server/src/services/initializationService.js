import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Check if main parts database tables exist
 */
async function checkPartsTablesExist() {
  try {
    const result = await pool.query(`
      SELECT 
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories') as categories,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'components') as components,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'manufacturers') as manufacturers,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'distributors') as distributors,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inventory') as inventory,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'activity_log') as activity_log,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'activity_types') as activity_types;
    `);
    
    const tables = result.rows[0];
    const allExist = Object.values(tables).every(exists => exists === true);
    
    return { allExist, tables };
  } catch (error) {
    console.error('Error checking parts tables:', error);
    return { allExist: false, tables: {} };
  }
}

/**
 * Initialize main parts database from init-schema.sql
 */
async function initializePartsDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Initializing parts database schema...');
    
    // Read the init-schema.sql file
    const sqlFilePath = path.resolve(__dirname, '../../../database/init-schema.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      console.error('❌ init-schema.sql file not found at:', sqlFilePath);
      return false;
    }
    
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL - wrap in try-catch to handle duplicate trigger/constraint errors
    try {
      await client.query(sql);
      console.log('✅ Parts database schema initialized successfully');
      console.log('   Tables created: categories, components, manufacturers, distributors, inventory, activity_log, etc.');
    } catch (initError) {
      // If error is about existing triggers/constraints, that's actually OK - database is already initialized
      const errorMsg = initError.message || '';
      if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
        console.log('ℹ️  Parts database schema already exists (some objects were already created)');
        console.log('   This is normal for an existing database - skipping duplicate creation');
      } else {
        // For other errors, rethrow
        throw initError;
      }
    }
    
    console.log('');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize parts database:', error.message);
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
    console.error('Error checking users table:', error);
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
    console.error('Error checking activity_types table:', error);
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
      'created_at', 'created_by', 'last_login', 'is_active'
    ];
    
    const existingColumns = result.rows.map(row => row.column_name);
    const hasAllColumns = requiredColumns.every(col => existingColumns.includes(col));
    
    if (!hasAllColumns) {
      console.warn('⚠️  Users table exists but schema is incomplete');
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      console.warn('   Missing columns:', missingColumns.join(', '));
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating users table schema:', error);
    return false;
  }
}

/**
 * Initialize users table from SQL file
 */
async function initializeUsersTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Initializing users table...');
    
    // Read the init-users.sql file
    const sqlFilePath = path.resolve(__dirname, '../../../database/init-users.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      console.error('❌ init-users.sql file not found at:', sqlFilePath);
      return false;
    }
    
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL
    await client.query(sql);
    
    console.log('✅ Users table initialized successfully');
    console.log('');
    console.log('   Default admin user created:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('');
    console.log('   ⚠️  IMPORTANT: Change the default password after first login!');
    console.log('');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize users table:', error.message);
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
    console.error('Error checking default admin:', error);
    return false;
  }
}

/**
 * Create default admin user if missing
 */
async function createDefaultAdmin() {
  try {
    console.log('🔧 Creating default admin user...');
    
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.query(`
      INSERT INTO users (username, password_hash, role, is_active) 
      VALUES ($1, $2, 'admin', true)
      ON CONFLICT (username) DO NOTHING;
    `, ['admin', hashedPassword]);
    
    console.log('✅ Default admin user created');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   ⚠️  Change this password immediately!');
    console.log('');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to create default admin:', error.message);
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
      console.log('⚠️  activity_types table not found, skipping user activity types');
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
    console.error('Error ensuring user activity types:', error.message);
    return false;
  }
}

/**
 * Main initialization function
 * Runs on server startup to ensure database and authentication are ready
 */
export async function initializeAuthentication() {
  console.log('');
  console.log('🚀 Starting database initialization...');
  console.log('');
  
  try {
    // First, check if main parts database exists
    console.log('📦 Checking parts database schema...');
    const { allExist: partsExist, tables: partsTables } = await checkPartsTablesExist();
    
    if (!partsExist) {
      console.log('⚠️  Parts database incomplete - initializing from init-schema.sql');
      const missingTables = Object.entries(partsTables)
        .filter(([_, exists]) => !exists)
        .map(([name]) => name);
      
      if (missingTables.length > 0) {
        console.log(`   Missing tables: ${missingTables.join(', ')}`);
      }
      
      const initialized = await initializePartsDatabase();
      
      if (!initialized) {
        console.error('❌ Failed to initialize parts database');
        console.error('   Core functionality will not work until this is resolved');
        console.error('   Please check database/init-schema.sql file exists');
        // Continue anyway to try to set up authentication
      } else {
        console.log('✅ Parts database initialized successfully');
      }
    } else {
      console.log('✅ Parts database schema verified');
    }
    
    console.log('');
    console.log('🔐 Checking authentication setup...');
    console.log('');
    
    // Check if users table exists
    const usersTableExists = await checkUsersTableExists();
    
    if (!usersTableExists) {
      console.log('⚠️  Users table not found - initializing from init-users.sql');
      const initialized = await initializeUsersTable();
      
      if (!initialized) {
        console.error('❌ Failed to initialize users table');
        console.error('   Authentication will not work until this is resolved');
        console.error('   Please check database/init-users.sql file exists');
        return false;
      }
      
      // Ensure activity types exist
      await ensureUserActivityTypes();
      
      console.log('✅ Authentication setup complete');
      console.log('');
      return true;
    }
    
    // Table exists - validate schema
    const schemaValid = await validateUsersTableSchema();
    
    if (!schemaValid) {
      console.error('❌ Users table schema is invalid');
      console.error('   Please run database/init-users.sql manually or drop the table to auto-recreate');
      return false;
    }
    
    // Check if default admin exists
    const adminExists = await checkDefaultAdminExists();
    
    if (!adminExists) {
      console.log('⚠️  Default admin user not found - creating...');
      await createDefaultAdmin();
    } else {
      console.log('✅ Users table found with valid schema');
    }
    
    // Ensure activity types exist
    await ensureUserActivityTypes();
    
    console.log('✅ Authentication setup verified');
    console.log('');
    
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error('   Server will start but functionality may be limited');
    console.error('');
    return false;
  }
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
      ready: usersTableExists && schemaValid && adminExists
    };
  } catch (error) {
    return {
      usersTableExists: false,
      schemaValid: false,
      defaultAdminExists: false,
      ready: false,
      error: error.message
    };
  }
}
