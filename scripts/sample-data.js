#!/usr/bin/env node

/**
 * Sample Data Loader Script
 * Loads sample components into the database
 */

import { Client } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const config = {
  host: process.env.DB_HOST || 'infra.main.local',
  port: parseInt(process.env.DB_PORT) || 5435,
  user: process.env.DB_USER || 'sami',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'cip',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function loadSampleData() {
  log('==================================', 'green');
  log('Loading Sample Data', 'green');
  log('==================================', 'green');
  console.log();

  const client = new Client(config);

  try {
    await client.connect();
    log('✓ Connected to database', 'green');
    
    log('Loading sample data from sample-data.sql...', 'yellow');
    const sampleDataPath = join(__dirname, '..', 'database', 'sample-data.sql');
    const sampleData = readFileSync(sampleDataPath, 'utf8');
    
    await client.query(sampleData);
    log('✓ Sample data loaded successfully', 'green');
    
    // Show record counts
    console.log();
    log('Record counts by table:', 'blue');
    
    const categoryTables = [
      'capacitors', 'resistors', 'ics', 'diodes', 'inductors',
      'connectors', 'crystals_and_oscillators', 'relays', 
      'switches', 'transformers', 'misc'
    ];
    
    for (const table of categoryTables) {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = result.rows[0].count;
      if (parseInt(count) > 0) {
        console.log(`  ✓ ${table}: ${count}`);
      }
    }
    
    // Show components count
    const componentsResult = await client.query('SELECT COUNT(*) as count FROM components');
    console.log();
    log(`Total components (master table): ${componentsResult.rows[0].count}`, 'green');
    
    // Show manufacturers count
    const mfgResult = await client.query('SELECT COUNT(*) as count FROM manufacturers');
    log(`Total manufacturers: ${mfgResult.rows[0].count}`, 'green');
    
    console.log();
    log('==================================', 'green');
    log('Sample data loaded successfully!', 'green');
    log('==================================', 'green');
    
  } catch (error) {
    log('Error loading sample data:', 'red');
    console.error(error.message);
    
    if (error.message.includes('duplicate key')) {
      console.log();
      log('Note: Some sample data may already exist in the database.', 'yellow');
      log('This is normal and can be ignored.', 'yellow');
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

loadSampleData().catch(error => {
  log('Fatal error:', 'red');
  console.error(error);
  process.exit(1);
});
