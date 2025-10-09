#!/usr/bin/env node

/**
 * CIS Database Verification Script
 * Verifies the CIS-compliant schema without modifying anything
 */

import { Client } from 'pg';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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

async function verifyCISSchema() {
  log('=' .repeat(60), 'cyan');
  log('AllegroSQL CIS Database Verification', 'cyan');
  log('=' .repeat(60), 'cyan');
  console.log();

  const client = new Client(config);

  try {
    await client.connect();
    log('✓ Connected to database', 'green');
    console.log();

    // Check CIS category tables
    log('Checking CIS Category Tables...', 'blue');
    const cisTableNames = [
      'capacitors', 'resistors', 'ics', 'diodes', 'inductors',
      'connectors', 'crystals_and_oscillators', 'relays',
      'switches', 'transformers', 'misc'
    ];

    let cisTablesFound = 0;
    for (const tableName of cisTableNames) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName]);
      
      if (result.rows[0].exists) {
        cisTablesFound++;
        log(`  ✓ ${tableName}`, 'green');
      } else {
        log(`  ✗ ${tableName} (missing)`, 'red');
      }
    }

    console.log();
    if (cisTablesFound === 11) {
      log('✓ All 11 CIS category tables found!', 'green');
    } else {
      log(`⚠ Only ${cisTablesFound} of 11 CIS tables found`, 'yellow');
    }

    // Check component_categories
    console.log();
    log('Checking Component Categories...', 'blue');
    const categoriesResult = await client.query(`
      SELECT id, name, table_name 
      FROM component_categories 
      ORDER BY id
    `);

    if (categoriesResult.rows.length > 0) {
      log(`  Found ${categoriesResult.rows.length} categories:`, 'green');
      categoriesResult.rows.forEach(row => {
        console.log(`    ${row.id}. ${row.name} → ${row.table_name}`);
      });
    } else {
      log('  ⚠ No categories found', 'yellow');
    }

    // Check triggers
    console.log();
    log('Checking Synchronization Triggers...', 'blue');
    const triggersResult = await client.query(`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers 
      WHERE trigger_schema = 'public'
      AND (trigger_name LIKE '%to_components%' OR trigger_name LIKE '%to_category%')
      ORDER BY event_object_table, trigger_name
    `);

    if (triggersResult.rows.length > 0) {
      log(`  Found ${triggersResult.rows.length} synchronization triggers:`, 'green');
      const categoryTriggers = triggersResult.rows.filter(r => 
        r.trigger_name.includes('to_components')
      );
      const masterTriggers = triggersResult.rows.filter(r => 
        r.trigger_name.includes('to_category')
      );
      console.log(`    Category → Components: ${categoryTriggers.length}`);
      console.log(`    Components → Category: ${masterTriggers.length}`);
    } else {
      log('  ⚠ No synchronization triggers found', 'yellow');
    }

    // Check data counts
    console.log();
    log('Data Counts...', 'blue');
    
    // Check each category table
    for (const tableName of cisTableNames) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        const count = parseInt(result.rows[0].count);
        if (count > 0) {
          log(`  ${tableName}: ${count} components`, 'cyan');
        }
      } catch (error) {
        // Table doesn't exist, skip
      }
    }

    // Master components table
    const componentsResult = await client.query('SELECT COUNT(*) as count FROM components');
    console.log();
    log(`Master components table: ${componentsResult.rows[0].count} total`, 'green');

    // Manufacturers
    const mfgResult = await client.query('SELECT COUNT(*) as count FROM manufacturers');
    log(`Manufacturers: ${mfgResult.rows[0].count}`, 'green');

    // Distributors
    const distResult = await client.query('SELECT COUNT(*) as count FROM distributors');
    log(`Distributors: ${distResult.rows[0].count}`, 'green');

    console.log();
    log('=' .repeat(60), 'cyan');
    log('Verification Complete', 'cyan');
    log('=' .repeat(60), 'cyan');

  } catch (error) {
    log('Error during verification:', 'red');
    console.error(error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyCISSchema().catch(error => {
  log('Fatal error:', 'red');
  console.error(error);
  process.exit(1);
});
