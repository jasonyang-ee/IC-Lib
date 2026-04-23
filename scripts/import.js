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
 * - Links CAD files from /library directories
 * - Supports dry-run mode for testing
 * - Provides detailed logging and error reporting
 *
 * Usage:
 *   node import.js                    # Import all CSV files
 *   node import.js --dry-run          # Test without inserting
 *   node import.js --file Diodes      # Import specific category
 *   node import.js --help             # Show help
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { FOOTPRINT_PRIMARY_EXTENSIONS, FOOTPRINT_SECONDARY_EXTENSION } from '../server/src/utils/footprintFiles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Category cache - populated dynamically from database
const categoryCache = new Map();

/**
 * Get category ID by name from database
 * Uses caching to avoid repeated queries
 */
async function getCategoryIdByName(categoryName) {
  if (!categoryName) return null;

  // Check cache first
  if (categoryCache.has(categoryName)) {
    return categoryCache.get(categoryName);
  }

  try {
    const result = await pool.query(
      'SELECT id FROM component_categories WHERE name = $1',
      [categoryName],
    );

    if (result.rows.length > 0) {
      const categoryId = result.rows[0].id;
      categoryCache.set(categoryName, categoryId);
      return categoryId;
    }

    // Cache miss - store null to avoid repeated queries
    categoryCache.set(categoryName, null);
    return null;
  } catch (error) {
    console.error(`Error looking up category "${categoryName}": ${error.message}`);
    return null;
  }
}

// ===== CAD File Library Scanning =====

const LIBRARY_BASE = path.join(__dirname, '..', 'library');

/**
 * Scan a library directory and build a case-insensitive lookup map.
 * Returns Map: lowercased base name (no extension) -> [actual filenames]
 * Optionally filters by file extensions.
 */
function scanDirectory(dirPath, extensions = null) {
  const map = new Map();
  if (!fs.existsSync(dirPath)) return map;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (extensions && !extensions.includes(ext)) continue;

    const baseName = path.basename(entry.name, path.extname(entry.name)).toLowerCase();
    if (!map.has(baseName)) map.set(baseName, []);
    map.get(baseName).push(entry.name);
  }
  return map;
}

// Pre-scan library directories at startup
const footprintFileMap = scanDirectory(path.join(LIBRARY_BASE, 'footprint'), [FOOTPRINT_SECONDARY_EXTENSION, ...FOOTPRINT_PRIMARY_EXTENSIONS]);
const symbolFileMap = scanDirectory(path.join(LIBRARY_BASE, 'symbol'), ['.olb']);
const modelFileMap = scanDirectory(path.join(LIBRARY_BASE, 'model'));
const pspiceFileMap = scanDirectory(path.join(LIBRARY_BASE, 'pspice'));
const padFileMap = scanDirectory(path.join(LIBRARY_BASE, 'pad'));

console.log(`Library scan: ${footprintFileMap.size} footprint, ${symbolFileMap.size} symbol, ${modelFileMap.size} model, ${pspiceFileMap.size} pspice, ${padFileMap.size} pad base names found`);

/**
 * Register a CAD file in cad_files table and link it to a component.
 */
async function registerAndLink(client, fileName, fileType, componentId) {
  const subdir = fileType; // footprint, symbol, model, pspice
  const filePath = path.join(LIBRARY_BASE, subdir, fileName);
  let fileSize = null;
  try { fileSize = fs.statSync(filePath).size; } catch { /* file may not exist locally */ }

  // Register in cad_files (upsert)
  const result = await client.query(`
    INSERT INTO cad_files (file_name, file_type, file_path, file_size)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (file_name, file_type) DO UPDATE SET
      file_size = COALESCE(EXCLUDED.file_size, cad_files.file_size),
      updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `, [fileName, fileType, `${subdir}/${fileName}`, fileSize]);

  const cadFileId = result.rows[0].id;

  // Link to component (ignore if already linked)
  await client.query(`
    INSERT INTO component_cad_files (component_id, cad_file_id)
    VALUES ($1, $2)
    ON CONFLICT (component_id, cad_file_id) DO NOTHING
  `, [componentId, cadFileId]);

  return cadFileId;
}

// Map cad_files file_type to TEXT column name (mirrors cadFileService.js)
const FILE_TYPE_TO_COLUMN = {
  footprint: 'pcb_footprint',
  symbol: 'schematic',
  model: 'step_model',
  pspice: 'pspice',
  pad: 'pad_file',
};

/**
 * Regenerate all TEXT columns for a component from the junction table.
 * Mirrors cadFileService.regenerateAllCadText() but uses the import client.
 */
async function regenerateAllCadText(client, componentId) {
  for (const [fileType, column] of Object.entries(FILE_TYPE_TO_COLUMN)) {
    const result = await client.query(`
      SELECT string_agg(DISTINCT regexp_replace(cf.file_name, '\\.[^.]+$', ''), ',') as text_value
      FROM component_cad_files ccf
      JOIN cad_files cf ON ccf.cad_file_id = cf.id
      WHERE ccf.component_id = $1 AND cf.file_type = $2
        AND cf.file_name NOT LIKE '%.dra'
    `, [componentId, fileType]);

    const textValue = result.rows[0]?.text_value || '';
    await client.query(
      `UPDATE components SET ${column} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [textValue, componentId],
    );
  }
}

/**
 * Link CAD files for a component based on CSV field values.
 * Searches pre-scanned library directories for matching files.
 */
async function linkCadFiles(client, componentId, record) {
  let linked = 0;

  // a. Footprint: comma-separated base names -> search .dra and the paired primary file (.psm or .bsm) in library/footprint
  const footprintValue = record['PCB Footprint']?.trim();
  if (footprintValue) {
    const baseNames = footprintValue.split(',').map(s => s.trim()).filter(Boolean);
    for (const baseName of baseNames) {
      const matches = footprintFileMap.get(baseName.toLowerCase());
      if (matches) {
        for (const fileName of matches) {
          await registerAndLink(client, fileName, 'footprint', componentId);
          linked++;
        }
      }
    }
  }

  // b. Schematic: may contain backslash (Filename\InternalName), extract filename
  //    then search .olb in library/symbol
  const schematicValue = record['Schematic Part']?.trim();
  if (schematicValue) {
    const entries = schematicValue.split(',').map(s => s.trim()).filter(Boolean);
    for (const entry of entries) {
      // Extract filename from "Filename\InternalName" format
      const fileName = entry.split('\\')[0].trim();
      if (!fileName) continue;

      const matches = symbolFileMap.get(fileName.toLowerCase());
      if (matches) {
        for (const fn of matches) {
          await registerAndLink(client, fn, 'symbol', componentId);
          linked++;
        }
      }
    }
  }

  // c. Step model: single base name -> search any file in library/model
  const stepModelValue = record.STEP_MODEL?.trim();
  if (stepModelValue && stepModelValue !== 'N/A') {
    const matches = modelFileMap.get(stepModelValue.toLowerCase());
    if (matches) {
      for (const fileName of matches) {
        await registerAndLink(client, fileName, 'model', componentId);
        linked++;
      }
    }
  }

  // d. PSpice: single base name -> search any file in library/pspice
  const pspiceValue = (record.PSPICE || record.PSpice || '').trim();
  if (pspiceValue && pspiceValue !== 'N/A') {
    const matches = pspiceFileMap.get(pspiceValue.toLowerCase());
    if (matches) {
      for (const fileName of matches) {
        await registerAndLink(client, fileName, 'pspice', componentId);
        linked++;
      }
    }
  }

  // e. Pad files: single base name -> search any file in library/pad
  const padValue = (record.PAD_FILE || record['Pad File'] || '').trim();
  if (padValue && padValue !== 'N/A') {
    const matches = padFileMap.get(padValue.toLowerCase());
    if (matches) {
      for (const fileName of matches) {
        await registerAndLink(client, fileName, 'pad', componentId);
        linked++;
      }
    }
  }

  return linked;
}

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
  node import.js [options]

Options:
  --dry-run           Test run without inserting data
  --file=<category>   Import only specific category (e.g., --file=Diodes)
  --help, -h          Show this help message

Examples:
  node import.js
  node import.js --dry-run
  node import.js --file=Diodes
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
  cadFileLinks: 0,
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
      `Loaded partsbox.json: ${partsboxData.length} parts, ${partsboxMap.size} with inventory data`,
    );
  }
} catch (error) {
  console.warn(`Warning: Could not load partsbox.json: ${error.message}`);
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
  console.log(`  + Created new manufacturer: ${manufacturerName}`);

  return insertResult.rows[0].id;
}

/**
 * Import a single CSV file
 */
async function importCSVFile(filePath) {
  const filename = path.basename(filePath);
  const categoryName = getCategoryFromFilename(filename);
  const categoryId = await getCategoryIdByName(categoryName);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Importing: ${filename}`);
  console.log(`Category: ${categoryName} (ID: ${categoryId || 'UNMAPPED'})`);
  console.log(`${'='.repeat(80)}`);

  if (!categoryId) {
    console.warn(`Warning: No category mapping found for ${categoryName}`);
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
        const subCategory4 = partTypeParts[3] || null;

        // Build component data (TEXT columns store raw base filenames)
        const componentData = {
          category_id: categoryId,
          part_number: partNumber,
          manufacturer_id: manufacturerId,
          manufacturer_pn: manufacturerPN || null,
          description: record.Description || null,
          value: record.Value || null,
          pcb_footprint: record['PCB Footprint']?.trim() || '',
          schematic: record['Schematic Part']?.trim() || '',
          package_size: record['Package Size'] || null,
          sub_category1: subCategory1,
          sub_category2: subCategory2,
          sub_category3: subCategory3,
          sub_category4: subCategory4,
          datasheet_url: record.Datasheet || null,
          step_model: record.STEP_MODEL?.trim() || '',
          pspice: (record.PSPICE || record.PSpice || '').trim(),
          pad_file: (record.PAD_FILE || record['Pad File'] || '').trim(),
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

          // Show CAD file matches
          const fpValue = componentData.pcb_footprint;
          if (fpValue) {
            for (const name of fpValue.split(',').map(s => s.trim()).filter(Boolean)) {
              const matches = footprintFileMap.get(name.toLowerCase());
              if (matches) console.log(`  Footprint match: ${name} -> ${matches.join(', ')}`);
            }
          }
          const schValue = componentData.schematic;
          if (schValue) {
            for (const entry of schValue.split(',').map(s => s.trim()).filter(Boolean)) {
              const fileName = entry.split('\\')[0].trim();
              const matches = symbolFileMap.get(fileName.toLowerCase());
              if (matches) console.log(`  Symbol match: ${fileName} -> ${matches.join(', ')}`);
            }
          }
          if (componentData.step_model) {
            const matches = modelFileMap.get(componentData.step_model.toLowerCase());
            if (matches) console.log(`  Model match: ${componentData.step_model} -> ${matches.join(', ')}`);
          }
          const padDryValue = componentData.pad_file;
          if (padDryValue) {
            const matches = padFileMap.get(padDryValue.toLowerCase());
            if (matches) console.log(`  Pad match: ${padDryValue} -> ${matches.join(', ')}`);
          }
        } else {
          // Insert component
          const insertResult = await client.query(
            `INSERT INTO components (
              category_id, part_number, manufacturer_id, manufacturer_pn,
              description, value, pcb_footprint, schematic, package_size,
              sub_category1, sub_category2, sub_category3, sub_category4,
              datasheet_url, step_model, pspice, pad_file
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (part_number) DO UPDATE SET
              category_id = EXCLUDED.category_id,
              description = EXCLUDED.description,
              manufacturer_id = EXCLUDED.manufacturer_id,
              manufacturer_pn = EXCLUDED.manufacturer_pn,
              value = EXCLUDED.value,
              pcb_footprint = EXCLUDED.pcb_footprint,
              schematic = EXCLUDED.schematic,
              package_size = EXCLUDED.package_size,
              step_model = EXCLUDED.step_model,
              pspice = EXCLUDED.pspice,
              pad_file = EXCLUDED.pad_file,
              sub_category1 = EXCLUDED.sub_category1,
              sub_category2 = EXCLUDED.sub_category2,
              sub_category3 = EXCLUDED.sub_category3,
              sub_category4 = EXCLUDED.sub_category4,
              datasheet_url = EXCLUDED.datasheet_url,
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
              componentData.sub_category4,
              componentData.datasheet_url,
              componentData.step_model,
              componentData.pspice,
              componentData.pad_file,
            ],
          );

          const componentId = insertResult.rows[0].id;

          // Link CAD files from library directories
          const cadLinked = await linkCadFiles(client, componentId, record);
          stats.cadFileLinks += cadLinked;

          // Regenerate TEXT columns from junction table (normalized format)
          if (cadLinked > 0) {
            await regenerateAllCadText(client, componentId);
          }

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
          `\n  x Error importing ${record.PART_NUMBER}: ${error.message}`,
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

    console.log(`\n\nSuccessfully imported ${imported} components`);
    if (skipped > 0) {
      console.log(`Skipped ${skipped} components due to errors`);
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
    console.log('\nDRY RUN MODE - No data will be inserted\n');
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
      console.error(`\nNo CSV files found matching: ${specificFile}\n`);
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
        `\nFatal error processing ${path.basename(file)}: ${error.message}\n`,
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
  console.log(`Inventory updates:          ${stats.inventoryUpdates}`);
  console.log(`CAD file links created:     ${stats.cadFileLinks}`);

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

  console.log('\nImport process completed\n');

  await pool.end();
}

// Run the script
if (__filename === process.argv[1]) {
  main().catch((error) => {
    console.error('\nFatal error:', error);
    pool.end();
    process.exit(1);
  });
}

export { importCSVFile, getCategoryFromFilename };
