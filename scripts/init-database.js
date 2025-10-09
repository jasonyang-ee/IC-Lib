#!/usr/bin/env node

/**
 * Allegro Component Library - Database Initialization Script (Node.js)
 * This script initializes a blank PostgreSQL database with the required schema
 */

import { Client } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Database configuration from environment or defaults
const config = {
  host: process.env.DB_HOST || 'infra.main.local',
  port: parseInt(process.env.DB_PORT) || 5435,
  user: process.env.DB_USER || 'sami',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'cip',
};

// Helper function to prompt user
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Helper function to log with color
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function initializeDatabase() {
  log('==================================', 'green');
  log('Allegro Component Library', 'green');
  log('Database Initialization Script', 'green');
  log('==================================', 'green');
  console.log();

  log('Database Configuration:', 'blue');
  console.log(`  Host: ${config.host}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  User: ${config.user}`);
  console.log(`  Database: ${config.database}`);
  console.log();

  const client = new Client(config);

  try {
    // Test connection
    log('Testing database connection...', 'yellow');
    await client.connect();
    log('✓ Database connection successful', 'green');
    console.log();

    // Check existing tables
    log('Checking existing schema...', 'yellow');
    const tableCountResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    const tableCount = parseInt(tableCountResult.rows[0].count);

    if (tableCount > 0) {
      log(`Warning: Database already contains ${tableCount} tables`, 'yellow');
      const answer = await prompt('Do you want to drop all tables and reinitialize? (yes/no): ');
      
      if (answer.toLowerCase() === 'yes') {
        log('Dropping existing tables...', 'yellow');
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public');
        await client.query(`GRANT ALL ON SCHEMA public TO ${config.user}`);
        await client.query('GRANT ALL ON SCHEMA public TO public');
        log('✓ Existing tables dropped', 'green');
      } else {
        log('Initialization cancelled', 'yellow');
        await client.end();
        process.exit(0);
      }
    }

    // Load and execute schema
    console.log();
    log('Initializing database schema...', 'yellow');
    
    const schemaPath = join(__dirname, '..', 'database', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    await client.query(schema);
    log('✓ Schema initialized successfully', 'green');
    console.log();

    // Verify tables
    log('Verifying installation...', 'yellow');
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);

    console.log('Tables created:');
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.tablename}`);
    });
    
    console.log();
    log('Verifying CIS-specific tables...', 'yellow');
    const cisTableNames = [
      'capacitors', 'resistors', 'ics', 'diodes', 'inductors', 
      'connectors', 'crystals_and_oscillators', 'relays', 
      'switches', 'transformers', 'misc'
    ];
    
    const cisTables = tablesResult.rows.filter(row => 
      cisTableNames.includes(row.tablename)
    );
    
    if (cisTables.length === 11) {
      log('✓ All 11 CIS category tables created successfully', 'green');
    } else {
      log(`⚠ Warning: Only ${cisTables.length} of 11 CIS tables found`, 'yellow');
    }
    
    // Verify triggers
    const triggersResult = await client.query(`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE trigger_schema = 'public'
      ORDER BY trigger_name
    `);
    
    console.log();
    log(`Triggers created: ${triggersResult.rows.length}`, 'blue');
    const categoryTriggers = triggersResult.rows.filter(row => 
      row.trigger_name.includes('to_components') || 
      row.trigger_name.includes('to_category')
    );
    log(`  ✓ Category synchronization triggers: ${categoryTriggers.length}`, 'green');

    // Ask about sample data
    console.log();
    const loadSample = await prompt('Do you want to load sample data? (yes/no): ');
    
    if (loadSample.toLowerCase() === 'yes') {
      log('Loading sample data...', 'yellow');
      
      const sampleDataPath = join(__dirname, '..', 'database', 'sample-data.sql');
      const sampleData = readFileSync(sampleDataPath, 'utf8');
      
      try {
        await client.query(sampleData);
        log('✓ Sample data loaded successfully', 'green');
        
        // Show record counts
        console.log();
        console.log('Record counts:');
        
        const counts = await client.query(`
          SELECT 'Components (Master)' as table_name, COUNT(*) as count FROM components
          UNION ALL
          SELECT 'Categories', COUNT(*) FROM component_categories
          UNION ALL
          SELECT 'Manufacturers', COUNT(*) FROM manufacturers
          UNION ALL
          SELECT 'Distributors', COUNT(*) FROM distributors
          UNION ALL
          SELECT 'Capacitors', COUNT(*) FROM capacitors
          UNION ALL
          SELECT 'Resistors', COUNT(*) FROM resistors
          UNION ALL
          SELECT 'ICs', COUNT(*) FROM ics
          UNION ALL
          SELECT 'Diodes', COUNT(*) FROM diodes
          UNION ALL
          SELECT 'Inductors', COUNT(*) FROM inductors
          UNION ALL
          SELECT 'Connectors', COUNT(*) FROM connectors
          UNION ALL
          SELECT 'Crystals/Oscillators', COUNT(*) FROM crystals_and_oscillators
          UNION ALL
          SELECT 'Relays', COUNT(*) FROM relays
          UNION ALL
          SELECT 'Switches', COUNT(*) FROM switches
          UNION ALL
          SELECT 'Transformers', COUNT(*) FROM transformers
          UNION ALL
          SELECT 'Misc', COUNT(*) FROM misc
        `);
        
        counts.rows.forEach(row => {
          console.log(`  ${row.table_name}: ${row.count}`);
        });
      } catch (error) {
        log('Warning: Failed to load sample data', 'yellow');
        console.log(`  Error: ${error.message}`);
      }
    }

    console.log();
    log('==================================', 'green');
    log('Database initialization complete!', 'green');
    log('==================================', 'green');
    console.log();
    console.log('Next steps:');
    console.log('  1. Start the backend server: cd server && npm run dev');
    console.log('  2. Start the frontend: cd client && npm run dev');
    console.log('  3. Open http://localhost:5173 in your browser');
    console.log();

  } catch (error) {
    log('Error during initialization:', 'red');
    console.error(error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the initialization
initializeDatabase().catch(error => {
  log('Fatal error:', 'red');
  console.error(error);
  process.exit(1);
});
