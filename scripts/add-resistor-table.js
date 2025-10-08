#!/usr/bin/env node

/**
 * Add Resistors Table and Sample Data
 */

import { Client } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

// Database configuration
const config = {
  host: process.env.DB_HOST || 'infra.main.local',
  port: parseInt(process.env.DB_PORT) || 5435,
  user: process.env.DB_USER || 'sami',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'cip',
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function addResistorTable() {
  log('==================================', 'green');
  log('Adding Resistors Table', 'green');
  log('==================================', 'green');
  console.log();

  const client = new Client(config);

  try {
    // Connect to database
    log('Connecting to database...', 'yellow');
    await client.connect();
    log('✓ Connected to database', 'green');
    console.log();

    // Read SQL file
    log('Reading SQL file...', 'yellow');
    const sqlPath = join(__dirname, '..', 'database', 'resistors-table.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    log('✓ SQL file loaded', 'green');
    console.log();

    // Execute SQL
    log('Executing SQL commands...', 'yellow');
    await client.query(sql);
    log('✓ Resistors table created', 'green');
    log('✓ Sample resistor data inserted', 'green');
    console.log();

    // Verify data
    log('Verifying data...', 'yellow');
    const result = await client.query(`
      SELECT 
        c.part_number,
        c.manufacturer_part_number,
        c.description,
        r.resistance,
        r.power_rating,
        r.tolerance,
        r.package_case
      FROM components c
      JOIN resistors r ON c.id = r.component_id
      WHERE c.manufacturer_part_number = 'CRCW06031K00FKEA'
    `);

    if (result.rows.length > 0) {
      log('✓ Data verified successfully', 'green');
      console.log();
      log('Inserted Resistor Details:', 'blue');
      console.log(JSON.stringify(result.rows[0], null, 2));
    }
    
    console.log();
    log('==================================', 'green');
    log('✓ Operation completed successfully', 'green');
    log('==================================', 'green');

  } catch (error) {
    log('✗ Error occurred:', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addResistorTable();
