#!/usr/bin/env node
/**
 * Check for invalid category IDs in the database
 * Category IDs should be integers (1-11), not UUIDs
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'allegrosql',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkInvalidCategories() {
  console.log('Checking for invalid category IDs...\n');

  try {
    // Check component_categories table for non-integer IDs
    const categoriesResult = await pool.query(`
      SELECT id, name FROM component_categories
      WHERE id::text ~ '[a-f]' OR id::text ~ '-'
    `);

    if (categoriesResult.rows.length > 0) {
      console.log('❌ Found invalid category IDs in component_categories:');
      categoriesResult.rows.forEach(row => {
        console.log(`  - ID: ${row.id}, Name: ${row.name}`);
      });
    } else {
      console.log('✅ All category IDs in component_categories are valid integers');
    }

    // Check components table for invalid category_id references
    const componentsResult = await pool.query(`
      SELECT id, part_number, category_id 
      FROM components
      WHERE category_id NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)
      LIMIT 10
    `);

    if (componentsResult.rows.length > 0) {
      console.log('\n❌ Found components with invalid category_id:');
      componentsResult.rows.forEach(row => {
        console.log(`  - Component: ${row.part_number}, Category ID: ${row.category_id}`);
      });
    } else {
      console.log('✅ All components have valid category_id references');
    }

    // Check for orphaned components (category_id is NULL)
    const orphanedResult = await pool.query(`
      SELECT id, part_number
      FROM components
      WHERE category_id IS NULL
      LIMIT 10
    `);

    if (orphanedResult.rows.length > 0) {
      console.log('\n⚠️  Found components with NULL category_id:');
      orphanedResult.rows.forEach(row => {
        console.log(`  - Component: ${row.part_number}`);
      });
    } else {
      console.log('✅ No orphaned components found');
    }

    console.log('\nCheck complete!');
  } catch (error) {
    console.error('Error checking categories:', error.message);
  } finally {
    await pool.end();
  }
}

checkInvalidCategories();
