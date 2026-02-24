import pool from '../config/database.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIBRARY_BASE = path.resolve(__dirname, '../../..', 'library');

// Map file type to filesystem subdirectory
const TYPE_SUBDIR = {
  footprint: 'footprint',
  symbol: 'symbol',
  model: 'model',
  pspice: 'pspice',
  pad: 'pad',
};

// Map cad_files file_type to TEXT column name in components table
const FILE_TYPE_TO_COLUMN = {
  footprint: 'pcb_footprint',
  symbol: 'schematic',
  model: 'step_model',
  pspice: 'pspice',
  pad: 'pad_file',
};

/**
 * Regenerate the TEXT column for a specific file type on a component.
 * Queries the junction table, strips file extensions, deduplicates base names,
 * and writes the comma-separated result to the components TEXT column.
 */
export async function regenerateCadText(componentId, fileType) {
  const column = FILE_TYPE_TO_COLUMN[fileType];
  if (!column) return;

  const result = await pool.query(`
    SELECT string_agg(DISTINCT regexp_replace(cf.file_name, '\\.[^.]+$', ''), ',') as text_value
    FROM component_cad_files ccf
    JOIN cad_files cf ON ccf.cad_file_id = cf.id
    WHERE ccf.component_id = $1 AND cf.file_type = $2
      AND cf.file_name NOT LIKE '%.dra'
  `, [componentId, fileType]);

  const textValue = result.rows[0]?.text_value || '';
  await pool.query(
    `UPDATE components SET ${column} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [textValue, componentId],
  );
}

/**
 * Regenerate all TEXT columns for a component.
 */
export async function regenerateAllCadText(componentId) {
  for (const fileType of Object.keys(FILE_TYPE_TO_COLUMN)) {
    await regenerateCadText(componentId, fileType);
  }
}

/**
 * Register a CAD file in the cad_files table.
 * Returns the cad_file record (existing or newly created).
 */
export async function registerCadFile(fileName, fileType, fileSize = null) {
  const result = await pool.query(`
    INSERT INTO cad_files (file_name, file_type, file_path, file_size)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (file_name, file_type) DO UPDATE SET
      file_size = COALESCE(EXCLUDED.file_size, cad_files.file_size),
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [fileName, fileType, `${TYPE_SUBDIR[fileType]}/${fileName}`, fileSize]);
  return result.rows[0];
}

/**
 * Link a CAD file to a component.
 * Inserts junction record and regenerates the TEXT column.
 */
export async function linkCadFileToComponent(cadFileId, componentId, fileType, _fileName) {
  // Insert junction record
  await pool.query(`
    INSERT INTO component_cad_files (component_id, cad_file_id)
    VALUES ($1, $2)
    ON CONFLICT (component_id, cad_file_id) DO NOTHING
  `, [componentId, cadFileId]);

  // Regenerate TEXT column from junction table
  await regenerateCadText(componentId, fileType);
}

/**
 * Link a CAD file to a component by manufacturer part number.
 * Used during file upload when we only have the MPN.
 */
export async function linkCadFileToComponentByMPN(cadFileId, mfgPartNumber, fileType, fileName) {
  // Find component by MPN
  const compResult = await pool.query(`
    SELECT id FROM components WHERE manufacturer_pn = $1
  `, [mfgPartNumber]);

  if (compResult.rows.length === 0) return null;

  const componentId = compResult.rows[0].id;
  await linkCadFileToComponent(cadFileId, componentId, fileType, fileName);
  return componentId;
}

/**
 * Unlink a CAD file from a component.
 * Removes junction record and regenerates TEXT column.
 */
export async function unlinkCadFileFromComponent(cadFileId, componentId, fileType, _fileName) {
  // Remove junction record
  await pool.query(`
    DELETE FROM component_cad_files
    WHERE component_id = $1 AND cad_file_id = $2
  `, [componentId, cadFileId]);

  // Regenerate TEXT column from junction table
  await regenerateCadText(componentId, fileType);
}

/**
 * Get all CAD files by type with component counts.
 */
export async function getCadFilesByType(fileType) {
  const result = await pool.query(`
    SELECT
      cf.id,
      cf.file_name,
      cf.file_type,
      cf.file_size,
      created_at(cf.id) as created_at,
      cf.updated_at,
      COUNT(ccf.component_id) as component_count
    FROM cad_files cf
    LEFT JOIN component_cad_files ccf ON cf.id = ccf.cad_file_id
    WHERE cf.file_type = $1
    GROUP BY cf.id
    ORDER BY cf.file_name ASC
  `, [fileType]);
  return result.rows;
}

/**
 * Get file type statistics (counts per type).
 */
export async function getCadFileStats() {
  const result = await pool.query(`
    SELECT
      cf.file_type,
      COUNT(DISTINCT cf.id) as file_count,
      COUNT(DISTINCT ccf.component_id) as component_count
    FROM cad_files cf
    LEFT JOIN component_cad_files ccf ON cf.id = ccf.cad_file_id
    GROUP BY cf.file_type
    ORDER BY cf.file_type
  `);

  const stats = {
    footprint: 0, symbol: 0, model: 0, pspice: 0, pad: 0,
  };
  for (const row of result.rows) {
    stats[row.file_type] = parseInt(row.file_count) || 0;
  }
  return stats;
}

/**
 * Get all components that use a specific CAD file.
 */
export async function getComponentsByCadFile(cadFileId) {
  const result = await pool.query(`
    SELECT
      c.id,
      c.part_number,
      c.manufacturer_pn,
      c.description,
      c.value,
      c.package_size,
      c.approval_status,
      m.name as manufacturer_name,
      cat.name as category_name
    FROM component_cad_files ccf
    JOIN components c ON ccf.component_id = c.id
    LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
    LEFT JOIN component_categories cat ON c.category_id = cat.id
    WHERE ccf.cad_file_id = $1
    ORDER BY c.part_number ASC
  `, [cadFileId]);
  return result.rows;
}

/**
 * Get all components that reference a file name of a given type.
 * Uses cad_files table via junction table only.
 */
export async function getComponentsByFileName(fileName, fileType) {
  const cfResult = await pool.query(`
    SELECT id FROM cad_files WHERE file_name = $1 AND file_type = $2
  `, [fileName, fileType]);

  if (cfResult.rows.length > 0) {
    return getComponentsByCadFile(cfResult.rows[0].id);
  }

  return [];
}

/**
 * Get all CAD files linked to a specific component.
 */
export async function getCadFilesForComponent(componentId) {
  const result = await pool.query(`
    SELECT
      cf.id,
      cf.file_name,
      cf.file_type,
      cf.file_path,
      cf.file_size,
      created_at(cf.id) as created_at
    FROM component_cad_files ccf
    JOIN cad_files cf ON ccf.cad_file_id = cf.id
    WHERE ccf.component_id = $1
    ORDER BY cf.file_type, cf.file_name
  `, [componentId]);
  return result.rows;
}

/**
 * Rename a CAD file (physical + database).
 * Updates cad_files table and regenerates TEXT columns for all affected components.
 */
export async function renameCadFile(cadFileId, newFileName) {
  // Get current file info
  const cfResult = await pool.query(`
    SELECT * FROM cad_files WHERE id = $1
  `, [cadFileId]);

  if (cfResult.rows.length === 0) {
    throw new Error('CAD file not found');
  }

  const cadFile = cfResult.rows[0];
  const oldFileName = cadFile.file_name;
  const subdir = TYPE_SUBDIR[cadFile.file_type];

  if (!subdir) throw new Error(`Invalid file type: ${cadFile.file_type}`);

  const oldPath = path.join(LIBRARY_BASE, subdir, oldFileName);
  const newPath = path.join(LIBRARY_BASE, subdir, newFileName);

  // Collision check
  if (fs.existsSync(newPath)) {
    throw new Error(`File "${newFileName}" already exists in the ${cadFile.file_type} directory`);
  }

  // Rename physical file if it exists
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }

  // Get affected components before update
  const affectedComponents = await getComponentsByCadFile(cadFileId);

  // Update cad_files table
  await pool.query(`
    UPDATE cad_files
    SET file_name = $1, file_path = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
  `, [newFileName, `${subdir}/${newFileName}`, cadFileId]);

  // Regenerate TEXT columns for all affected components
  for (const comp of affectedComponents) {
    await regenerateCadText(comp.id, cadFile.file_type);
  }

  return { oldFileName, newFileName, fileType: cadFile.file_type };
}

/**
 * Delete a CAD file from the system.
 * Removes physical file, cad_files record, and regenerates TEXT columns.
 */
export async function deleteCadFile(cadFileId) {
  // Get current file info
  const cfResult = await pool.query(`
    SELECT * FROM cad_files WHERE id = $1
  `, [cadFileId]);

  if (cfResult.rows.length === 0) {
    throw new Error('CAD file not found');
  }

  const cadFile = cfResult.rows[0];
  const subdir = TYPE_SUBDIR[cadFile.file_type];

  // Delete physical file if it exists
  if (subdir) {
    const filePath = path.join(LIBRARY_BASE, subdir, cadFile.file_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Get linked components before deletion (for response and TEXT regen)
  const linkedComponents = await getComponentsByCadFile(cadFileId);

  // Junction records are deleted via ON DELETE CASCADE on cad_files FK
  // Delete cad_files record
  await pool.query('DELETE FROM cad_files WHERE id = $1', [cadFileId]);

  // Regenerate TEXT columns for all affected components
  for (const comp of linkedComponents) {
    await regenerateCadText(comp.id, cadFile.file_type);
  }

  return { fileName: cadFile.file_name, fileType: cadFile.file_type, linkedComponents };
}

/**
 * Get orphan CAD files (not linked to any component).
 */
export async function getOrphanCadFiles(fileType = null) {
  let query = `
    SELECT
      cf.id,
      cf.file_name,
      cf.file_type,
      cf.file_size,
      created_at(cf.id) as created_at,
      cf.updated_at
    FROM cad_files cf
    LEFT JOIN component_cad_files ccf ON cf.id = ccf.cad_file_id
    WHERE ccf.id IS NULL
  `;
  const params = [];

  if (fileType) {
    query += ' AND cf.file_type = $1';
    params.push(fileType);
  }

  query += ' ORDER BY cf.file_type, cf.file_name';

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Search CAD files by name with optional type filter.
 */
export async function searchCadFiles(searchQuery, fileType = null) {
  const searchPattern = `%${searchQuery}%`;
  let query = `
    SELECT
      cf.id,
      cf.file_name,
      cf.file_type,
      cf.file_size,
      created_at(cf.id) as created_at,
      COUNT(ccf.component_id) as component_count
    FROM cad_files cf
    LEFT JOIN component_cad_files ccf ON cf.id = ccf.cad_file_id
    WHERE cf.file_name ILIKE $1
  `;
  const params = [searchPattern];

  if (fileType) {
    query += ' AND cf.file_type = $2';
    params.push(fileType);
  }

  query += ' GROUP BY cf.id ORDER BY cf.file_type, cf.file_name LIMIT 100';

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get CAD files linked to a specific component, grouped by file type.
 * Used for category-based file library view.
 */
export async function getCadFilesForComponentGrouped(componentId) {
  const result = await pool.query(`
    SELECT
      cf.id,
      cf.file_name,
      cf.file_type,
      cf.file_path,
      cf.file_size
    FROM component_cad_files ccf
    JOIN cad_files cf ON ccf.cad_file_id = cf.id
    WHERE ccf.component_id = $1
    ORDER BY cf.file_type, cf.file_name
  `, [componentId]);

  // Group by file type
  const grouped = {};
  for (const row of result.rows) {
    if (!grouped[row.file_type]) grouped[row.file_type] = [];
    grouped[row.file_type].push(row);
  }
  return grouped;
}

/**
 * Find a cad_file record by file name and type.
 */
export async function findCadFile(fileName, fileType) {
  const result = await pool.query(`
    SELECT * FROM cad_files WHERE file_name = $1 AND file_type = $2
  `, [fileName, fileType]);
  return result.rows[0] || null;
}

/**
 * Sync CAD files from a component's data to the junction table.
 * Accepts arrays of base filenames (no extensions) from TEXT columns.
 * Matches against cad_files records which store full filenames (with extensions).
 * After syncing junction records, regenerates all TEXT columns.
 */
export async function syncComponentCadFiles(componentId, cadData) {
  // cadData: { pcb_footprint: [], schematic: [], step_model: [], pspice: [], pad_file: [] }
  const columnToFileType = {
    pcb_footprint: 'footprint',
    schematic: 'symbol',
    step_model: 'model',
    pspice: 'pspice',
    pad_file: 'pad',
  };

  // Get current junction links (full filenames from cad_files)
  const currentLinks = await pool.query(`
    SELECT ccf.id, cf.id as cad_file_id, cf.file_name, cf.file_type
    FROM component_cad_files ccf
    JOIN cad_files cf ON ccf.cad_file_id = cf.id
    WHERE ccf.component_id = $1
  `, [componentId]);

  // Build desired base names per file type
  const desiredBaseNames = {};
  for (const [column, fileType] of Object.entries(columnToFileType)) {
    const names = cadData[column] || [];
    desiredBaseNames[fileType] = new Set(
      (Array.isArray(names) ? names : []).filter(n => n && typeof n === 'string'),
    );
  }

  // Remove junction records where the base name is no longer desired for that file type
  for (const row of currentLinks.rows) {
    const baseName = row.file_name.replace(/\.[^.]+$/, '');
    const desired = desiredBaseNames[row.file_type];
    if (desired && !desired.has(baseName)) {
      await pool.query('DELETE FROM component_cad_files WHERE id = $1', [row.id]);
    }
  }

  // Build set of already-linked base names per file type
  const linkedBaseNames = {};
  for (const row of currentLinks.rows) {
    const baseName = row.file_name.replace(/\.[^.]+$/, '');
    const desired = desiredBaseNames[row.file_type];
    // Only count as linked if it survived the deletion above
    if (desired && desired.has(baseName)) {
      if (!linkedBaseNames[row.file_type]) linkedBaseNames[row.file_type] = new Set();
      linkedBaseNames[row.file_type].add(baseName);
    }
  }

  // Add junction records for base names that aren't yet linked
  for (const [column, fileType] of Object.entries(columnToFileType)) {
    const baseNames = cadData[column] || [];
    const arr = Array.isArray(baseNames) ? baseNames : [];
    const alreadyLinked = linkedBaseNames[fileType] || new Set();

    for (const baseName of arr) {
      if (!baseName || typeof baseName !== 'string') continue;
      if (alreadyLinked.has(baseName)) continue;

      // Find an existing cad_file by base name pattern match
      const match = await pool.query(`
        SELECT id FROM cad_files
        WHERE file_type = $1 AND regexp_replace(file_name, '\\.[^.]+$', '') = $2
        LIMIT 1
      `, [fileType, baseName]);

      if (match.rows.length > 0) {
        await pool.query(`
          INSERT INTO component_cad_files (component_id, cad_file_id)
          VALUES ($1, $2)
          ON CONFLICT (component_id, cad_file_id) DO NOTHING
        `, [componentId, match.rows[0].id]);
      }
    }
  }

  // Regenerate all TEXT columns from junction table
  await regenerateAllCadText(componentId);
}

/**
 * Get all components in a category with their CAD file counts.
 * Used for the Category view in the File Library page.
 */
export async function getComponentsWithCadFiles(categoryId) {
  const result = await pool.query(`
    SELECT
      c.id,
      c.part_number,
      c.manufacturer_pn,
      c.description,
      c.value,
      c.package_size,
      m.name as manufacturer_name,
      COUNT(ccf.id) as cad_file_count
    FROM components c
    LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
    LEFT JOIN component_cad_files ccf ON c.id = ccf.component_id
    WHERE c.category_id = $1
    GROUP BY c.id, m.name
    ORDER BY c.part_number ASC
  `, [categoryId]);
  return result.rows;
}

/**
 * Get components that share any CAD file with a given component.
 */
export async function getComponentsSharingFiles(componentId) {
  const result = await pool.query(`
    SELECT DISTINCT
      c.id,
      c.part_number,
      c.manufacturer_pn,
      c.description,
      cf.file_name,
      cf.file_type
    FROM component_cad_files ccf1
    JOIN component_cad_files ccf2 ON ccf1.cad_file_id = ccf2.cad_file_id AND ccf2.component_id != $1
    JOIN components c ON ccf2.component_id = c.id
    JOIN cad_files cf ON ccf1.cad_file_id = cf.id
    WHERE ccf1.component_id = $1
    ORDER BY cf.file_type, cf.file_name, c.part_number
  `, [componentId]);
  return result.rows;
}

export default {
  regenerateCadText,
  regenerateAllCadText,
  registerCadFile,
  linkCadFileToComponent,
  linkCadFileToComponentByMPN,
  unlinkCadFileFromComponent,
  getCadFilesByType,
  getCadFileStats,
  getComponentsByCadFile,
  getComponentsByFileName,
  getCadFilesForComponent,
  renameCadFile,
  deleteCadFile,
  getOrphanCadFiles,
  searchCadFiles,
  getCadFilesForComponentGrouped,
  findCadFile,
  syncComponentCadFiles,
  getComponentsWithCadFiles,
  getComponentsSharingFiles,
};
