#!/usr/bin/env node

/**
 * CSV Import Script for Legacy CIS Database to New Schema
 *
 * This script imports CSV files exported from the legacy CIS database
 * into the new PostgreSQL schema defined in /database/init-schema.sql
 *
 * Features:
 * - Parses CSV files from /import directory
 * - Maps legacy fields to new schema
 * - Creates manufacturers if they don't exist
 * - Inserts components with specifications
 * - Handles category-specific field mappings
 * - Supports dry-run mode for testing
 * - Provides detailed logging and error reporting
 *
 * Usage:
 *   node import-csv-to-db.js                    # Import all CSV files
 *   node import-csv-to-db.js --dry-run          # Test without inserting
 *   node import-csv-to-db.js --file Diodes      # Import specific category
 *   node import-csv-to-db.js --help             # Show help
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Category mapping: CSV filename prefix -> Database category ID
const CATEGORY_MAP = {
  Capacitors: 1,
  Resistors: 2,
  Inductors: 3,
  Diodes: 4,
  Transistors: 5,
  ICs: 6,
  Connectors: 7,
  Switches: 8,
  Crystals: 10,
  Oscillators: 10,
  Mechanical: 12,
  Misc: 13,
  Relays: 14,
  Transformers: 15,
};

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const specificFile = args
  .find((arg) => arg.startsWith('--file='))
  ?.split('=')[1];
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log(`
CSV Import Script for Legacy CIS Database

Usage:
  node import-csv-to-db.js [options]

Options:
  --dry-run           Test run without inserting data
  --file=<category>   Import only specific category (e.g., --file=Diodes)
  --help, -h          Show this help message

Examples:
  node import-csv-to-db.js
  node import-csv-to-db.js --dry-run
  node import-csv-to-db.js --file=Diodes
  `);
  process.exit(0);
}

// Statistics
const stats = {
  totalFiles: 0,
  totalComponents: 0,
  successfulImports: 0,
  failedImports: 0,
  newManufacturers: 0,
  inventoryUpdates: 0,
  errors: [],
};

// Load partsbox.json for inventory data
let partsboxData = null;
const partsboxMap = new Map(); // Map manufacturer PN -> {quantity, location}

try {
  const partsboxPath = path.join(__dirname, '..', 'import', 'partsbox.json');
  if (fs.existsSync(partsboxPath)) {
    const partsboxContent = fs.readFileSync(partsboxPath, 'utf-8');
    const partsboxJson = JSON.parse(partsboxContent);

    // The actual data is nested in the 'data' property
    const data = partsboxJson.data || partsboxJson;
    partsboxData = data.parts || [];
    const storageData = data.storage || [];

    // Build storage ID -> name map
    const storageMap = new Map();
    storageData.forEach((storage) => {
      const storageId = storage['storage/id'];
      const storageName = storage['storage/name'];
      if (storageId && storageName) {
        storageMap.set(storageId, storageName);
      }
    });

    // Build partsbox map for quick lookups
    partsboxData.forEach((part) => {
      const manufacturerPN = part['part/name'];
      if (!manufacturerPN) return;

      let totalQuantity = 0;
      let lastStorageId = null;

      // Sum up all stock quantities and get storage ID
      const stock = part['part/stock'];
      if (stock && Array.isArray(stock)) {
        stock.forEach((stockEntry) => {
          const qty = stockEntry['stock/quantity'];
          if (typeof qty === 'number') {
            totalQuantity += qty;
          }

          // Track the last storage ID
          const storageId = stockEntry['stock/storage-id'];
          if (storageId) {
            lastStorageId = storageId;
          }
        });
      }

      // Map storage ID to name
      const lastLocation = lastStorageId ? storageMap.get(lastStorageId) : null;

      // Store in map if we have a location
      if (lastLocation) {
        partsboxMap.set(manufacturerPN, {
          quantity: totalQuantity,
          location: lastLocation,
        });
      }
    });

    console.log(
      `✓ Loaded partsbox.json: ${partsboxData.length} parts, ${partsboxMap.size} with inventory data`,
    );
  }
} catch (error) {
  console.warn(`⚠️  Warning: Could not load partsbox.json: ${error.message}`);
}

/**
 * Get inventory data from partsbox for a manufacturer part number
 */
function getInventoryFromPartsbox(manufacturerPN) {
  if (!partsboxMap || !manufacturerPN) return null;

  // Direct lookup from pre-built map
  return partsboxMap.get(manufacturerPN) || null;
}

/**
 * Format part number according to category leading zeros
 */
function formatPartNumber(originalPartNumber, prefix, leadingZeros) {
  // Extract the numeric part from the original part number
  // Pattern: PREFIX-NNNNNNNN (e.g., CAP-00000001 or RES-00000010)
  const match = originalPartNumber.match(/([A-Z]+)-(\d+)/i);

  if (!match) {
    // If pattern doesn't match, return original
    return originalPartNumber;
  }

  const numericPart = parseInt(match[2], 10);

  // Format with desired leading zeros
  const paddedNumber = numericPart.toString().padStart(leadingZeros, '0');

  return `${prefix}-${paddedNumber}`;
}

/**
 * Get category name from filename
 */
function getCategoryFromFilename(filename) {
  const baseName = path.basename(filename, '.csv');
  const categoryName = baseName.split('_')[0].replace(/^_/, '');
  return categoryName;
}

/**
 * Get or create manufacturer
 */
async function getOrCreateManufacturer(client, manufacturerName) {
  if (!manufacturerName || manufacturerName.trim() === '') {
    return null;
  }

  // Check if manufacturer exists
  const result = await client.query(
    'SELECT id FROM manufacturers WHERE name = $1',
    [manufacturerName],
  );

  if (result.rows.length > 0) {
    return result.rows[0].id;
  }

  // Create new manufacturer
  const insertResult = await client.query(
    'INSERT INTO manufacturers (name) VALUES ($1) RETURNING id',
    [manufacturerName],
  );

  stats.newManufacturers++;
  console.log(`  ✓ Created new manufacturer: ${manufacturerName}`);

  return insertResult.rows[0].id;
}

/**
 * Import a single CSV file
 */
async function importCSVFile(filePath) {
  const filename = path.basename(filePath);
  const categoryName = getCategoryFromFilename(filename);
  const categoryId = CATEGORY_MAP[categoryName];

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Importing: ${filename}`);
  console.log(`Category: ${categoryName} (ID: ${categoryId || 'UNMAPPED'})`);
  console.log(`${'='.repeat(80)}`);

  if (!categoryId) {
    console.warn(`⚠️  Warning: No category mapping found for ${categoryName}`);
    console.warn(
      '   You may need to create this category in the database first.',
    );
    return;
  }

  // Read and parse CSV
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  });

  console.log(`Found ${records.length} components to import\n`);

  const client = await pool.connect();

  try {
    // Get category info for part number formatting
    const categoryInfo = await client.query(
      'SELECT prefix, leading_zeros FROM component_categories WHERE id = $1',
      [categoryId],
    );

    if (categoryInfo.rows.length === 0) {
      throw new Error(`Category ${categoryId} not found in database`);
    }

    const { prefix, leading_zeros } = categoryInfo.rows[0];

    let imported = 0;
    let skipped = 0;

    for (const record of records) {
      try {
        await client.query('BEGIN');

        // Extract basic component data
        const originalPartNumber = record.PART_NUMBER;
        const manufacturerName = record.Manufacturer;
        const manufacturerPN = record['Manufacturer PN'];
        const manufacturerId = manufacturerName
          ? await getOrCreateManufacturer(client, manufacturerName)
          : null;

        // Format part number according to category settings
        const partNumber = formatPartNumber(
          originalPartNumber,
          prefix,
          leading_zeros,
        );

        // Parse Part Type into sub categories (split by backslash)
        const partType = record['Part Type'] || '';
        const partTypeParts = partType.split('\\').map(s => s.trim()).filter(s => s);
        const subCategory1 = partTypeParts[0] || null;
        const subCategory2 = partTypeParts[1] || null;
        const subCategory3 = partTypeParts[2] || null;

        // Build component data
        const componentData = {
          category_id: categoryId,
          part_number: partNumber,
          manufacturer_id: manufacturerId,
          manufacturer_pn: manufacturerPN || null,
          description: record.Description || null,
          value: record.Value || null,
          pcb_footprint: record['PCB Footprint'] || null,
          schematic: record['Schematic Part'] || null,
          package_size: record['Package Size'] || null,
          sub_category1: subCategory1,
          sub_category2: subCategory2,
          sub_category3: subCategory3,
          datasheet_url: record.Datasheet || null,
          step_model: record.STEP_MODEL || null,
          status: 'Active',
        };

        if (isDryRun) {
          console.log(
            `[DRY RUN] Would insert: ${partNumber} (original: ${originalPartNumber})`,
          );

          // Show inventory info if found
          if (manufacturerPN) {
            const inventory = getInventoryFromPartsbox(manufacturerPN);
            if (inventory) {
              console.log(
                `  Inventory: ${inventory.quantity} @ ${inventory.location}`,
              );
            }
          }
        } else {
          // Insert component
          const insertResult = await client.query(
            `INSERT INTO components (
              category_id, part_number, manufacturer_id, manufacturer_pn,
              description, value, pcb_footprint, schematic, package_size,
              sub_category1, sub_category2, sub_category3, datasheet_url, step_model, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (part_number) DO UPDATE SET
              description = EXCLUDED.description,
              manufacturer_id = EXCLUDED.manufacturer_id,
              manufacturer_pn = EXCLUDED.manufacturer_pn,
              value = EXCLUDED.value,
              sub_category1 = EXCLUDED.sub_category1,
              sub_category2 = EXCLUDED.sub_category2,
              sub_category3 = EXCLUDED.sub_category3,
              updated_at = CURRENT_TIMESTAMP
            RETURNING id`,
            [
              componentData.category_id,
              componentData.part_number,
              componentData.manufacturer_id,
              componentData.manufacturer_pn,
              componentData.description,
              componentData.value,
              componentData.pcb_footprint,
              componentData.schematic,
              componentData.package_size,
              componentData.sub_category1,
              componentData.sub_category2,
              componentData.sub_category3,
              componentData.datasheet_url,
              componentData.step_model,
              componentData.status,
            ],
          );

          const componentId = insertResult.rows[0].id;

          // Update inventory from partsbox data
          if (manufacturerPN) {
            const inventory = getInventoryFromPartsbox(manufacturerPN);
            if (inventory) {
              // Insert or update inventory record
              await client.query(
                `INSERT INTO inventory (component_id, quantity, location, updated_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                 ON CONFLICT (component_id) 
                 DO UPDATE SET 
                   quantity = EXCLUDED.quantity,
                   location = EXCLUDED.location,
                   updated_at = CURRENT_TIMESTAMP`,
                [componentId, inventory.quantity, inventory.location],
              );
              stats.inventoryUpdates++;
            }
          }

          imported++;
          if (imported % 10 === 0) {
            process.stdout.write(
              `\r  Progress: ${imported}/${records.length} components imported...`,
            );
          }
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(
          `\n  ✗ Error importing ${record.PART_NUMBER}: ${error.message}`,
        );
        stats.errors.push({
          file: filename,
          partNumber: record.PART_NUMBER,
          error: error.message,
        });
        stats.failedImports++;
        skipped++;
      }
    }

    console.log(`\n\n✓ Successfully imported ${imported} components`);
    if (skipped > 0) {
      console.log(`⚠️  Skipped ${skipped} components due to errors`);
    }

    stats.successfulImports += imported;
  } finally {
    client.release();
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('CSV Import Script - Legacy CIS to New Schema');
  console.log('='.repeat(80));

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN MODE - No data will be inserted\n');
  }

  const importDir = path.join(__dirname, '..', 'import');

  // Get all CSV files
  let files = fs
    .readdirSync(importDir)
    .filter((f) => f.endsWith('.csv'))
    .map((f) => path.join(importDir, f));

  // Filter by specific file if requested
  if (specificFile) {
    files = files.filter((f) => path.basename(f).includes(specificFile));
    if (files.length === 0) {
      console.error(`\n✗ No CSV files found matching: ${specificFile}\n`);
      process.exit(1);
    }
  }

  stats.totalFiles = files.length;
  console.log(`Found ${files.length} CSV file(s) to import\n`);

  // Import each file
  for (const file of files) {
    try {
      await importCSVFile(file);
      stats.totalComponents++;
    } catch (error) {
      console.error(
        `\n✗ Fatal error processing ${path.basename(file)}: ${error.message}\n`,
      );
      stats.errors.push({
        file: path.basename(file),
        error: error.message,
      });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('Import Summary');
  console.log('='.repeat(80));
  console.log(`Total files processed:      ${stats.totalFiles}`);
  console.log(`Total components:           ${stats.totalComponents}`);
  console.log(`Successful imports:         ${stats.successfulImports}`);
  console.log(`Failed imports:             ${stats.failedImports}`);
  console.log(`New manufacturers created:  ${stats.newManufacturers}`);

  if (stats.errors.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('Errors');
    console.log('='.repeat(80));
    stats.errors.forEach((err, idx) => {
      console.log(`${idx + 1}. File: ${err.file}`);
      if (err.partNumber) {
        console.log(`   Part: ${err.partNumber}`);
      }
      console.log(`   Error: ${err.error}\n`);
    });
  }

  console.log('\n✓ Import process completed\n');

  await pool.end();
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('\n✗ Fatal error:', error);
    pool.end();
    process.exit(1);
  });
}

module.exports = { importCSVFile, getCategoryFromFilename };
