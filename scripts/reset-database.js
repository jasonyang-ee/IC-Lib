#!/usr/bin/env node

/**
 * Database Reset Script
 * Drops all tables and reinitializes the database
 */

import { Client } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

const config = {
  host: process.env.DB_HOST || 'infra.main.local',
  port: parseInt(process.env.DB_PORT) || 5435,
  user: process.env.DB_USER || 'sami',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'cip',
};

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

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function resetDatabase() {
  log('⚠️  WARNING: This will DROP ALL DATA in the database!', 'yellow');
  console.log();
  
  const confirm1 = await prompt('Are you sure you want to continue? (yes/no): ');
  if (confirm1.toLowerCase() !== 'yes') {
    log('Reset cancelled', 'yellow');
    process.exit(0);
  }

  const confirm2 = await prompt('Type "DELETE ALL DATA" to confirm: ');
  if (confirm2 !== 'DELETE ALL DATA') {
    log('Reset cancelled - confirmation text did not match', 'yellow');
    process.exit(0);
  }

  const client = new Client(config);

  try {
    await client.connect();
    log('✓ Connected to database', 'green');

    log('Dropping all tables...', 'yellow');
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query(`GRANT ALL ON SCHEMA public TO ${config.user}`);
    await client.query('GRANT ALL ON SCHEMA public TO public');
    log('✓ All tables dropped', 'green');

    log('Reinitializing schema...', 'yellow');
    const schemaPath = join(__dirname, '..', 'database', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    await client.query(schema);
    log('✓ Schema reinitialized', 'green');

    console.log();
    log('Database reset complete!', 'green');
    
  } catch (error) {
    log('Error during reset:', 'red');
    console.error(error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetDatabase().catch(error => {
  log('Fatal error:', 'red');
  console.error(error);
  process.exit(1);
});
