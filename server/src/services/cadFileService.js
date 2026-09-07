import pool from '../config/database.js';
import { isEcoEnabled } from '../utils/featureFlags.js';
import { canDirectEditComponentInEcoMode } from './componentLifecycleService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  CAD_FILE_TYPE_TO_COLUMN as FILE_TYPE_TO_COLUMN,
  CAD_TYPE_SUBDIR as TYPE_SUBDIR,
  MODEL_FILE_EXTENSIONS,
  PSPICE_FILE_EXTENSIONS,
} from '../constants/cadFiles.js';
import {
  FOOTPRINT_PRIMARY_EXTENSIONS,
  FOOTPRINT_SECONDARY_EXTENSION,
  canonicalizeCadUploadFilename,
  getCadFileBaseName,
  isCanonicalPackageFileType,
} from '../utils/footprintFiles.js';
import { assertSafeLeafName, resolvePathWithinBase } from '../utils/safeFsPaths.js';
import { logError, logInfo, logWarn } from '../utils/logger.js';
import { listPackages } from './packageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIBRARY_BASE = path.resolve(__dirname, '../../..', 'library');

const FOOTPRINT_RELATED_FILE_TYPES = ['pad', 'model'];

function uniqueValues(values) {
  return [...new Set((Array.isArray(values) ? values : [values]).filter(Boolean))];
}

function filterTrackableCadRows(rows, fileType = null) {
  return (Array.isArray(rows) ? rows : []).filter((row) => isTrackableCadFile(row?.file_name, fileType || row?.file_type));
}

function summarizeFootprintRelatedCadFiles(componentCadFiles) {
  const normalizedCadFiles = Array.isArray(componentCadFiles) ? componentCadFiles : [];
  const footprintCadFiles = normalizedCadFiles.filter((file) => file.file_type === 'footprint');
  const relatedCadFilesByType = new Map(
    FOOTPRINT_RELATED_FILE_TYPES.map((fileType) => [
      fileType,
      normalizedCadFiles.filter((file) => file.file_type === fileType),
    ]),
  );

  return {
    footprintCadFiles,
    footprintCadFileIds: footprintCadFiles.map((file) => file.id),
    footprintBaseNames: new Set(
      footprintCadFiles
        .map((file) => getCadFileBaseName(file.file_name).toLowerCase())
        .filter(Boolean),
    ),
    relatedCadFilesByType,
  };
}

function isSimpleFootprintAutoLinkCandidate(componentCadFiles) {
  const summary = summarizeFootprintRelatedCadFiles(componentCadFiles);

  if (summary.footprintBaseNames.size !== 1) {
    return false;
  }

  return FOOTPRINT_RELATED_FILE_TYPES.every(
    (fileType) => (summary.relatedCadFilesByType.get(fileType)?.length || 0) <= 1,
  );
}

function compareCadTextBaseNames(fileType, left, right) {
  const leftName = String(left || '');
  const rightName = String(right || '');

  if (fileType === 'footprint') {
    const leftIsNormalVariant = /_n$/i.test(leftName);
    const rightIsNormalVariant = /_n$/i.test(rightName);

    if (leftIsNormalVariant !== rightIsNormalVariant) {
      return leftIsNormalVariant ? -1 : 1;
    }
  }

  const caseInsensitiveCompare = leftName.localeCompare(rightName, undefined, { sensitivity: 'base' });
  return caseInsensitiveCompare || leftName.localeCompare(rightName);
}

async function getComponentFootprintRelatedFiles(componentId, db = pool) {
  const result = await db.query(`
    SELECT
      cf.id,
      cf.file_name,
      cf.file_type,
      cf.file_size,
      cf.missing
    FROM component_cad_files ccf
    JOIN cad_files cf ON ccf.cad_file_id = cf.id
    WHERE ccf.component_id = $1
      AND cf.file_type IN ('footprint', 'pad', 'model')
    ORDER BY cf.file_type, cf.file_name
  `, [componentId]);

  return result.rows;
}

/**
 * Regenerate the TEXT column for a specific file type on a component.
 * Queries the junction table, strips file extensions, deduplicates base names,
 * and writes the comma-separated result to the components TEXT column.
 *
 * Accepts an optional database client so callers already inside a transaction
 * can reuse the same connection and avoid self-blocking on row locks.
 */
export async function regenerateCadText(componentId, fileType, db = pool) {
  const column = FILE_TYPE_TO_COLUMN[fileType];
  if (!column) return;

  const result = await db.query(`
    SELECT DISTINCT regexp_replace(cf.file_name, '\\.[^.]+$', '') as base_name
    FROM component_cad_files ccf
    JOIN cad_files cf ON ccf.cad_file_id = cf.id
    WHERE ccf.component_id = $1 AND cf.file_type = $2
      AND cf.file_name NOT LIKE '%.dra'
  `, [componentId, fileType]);

  const textValue = [...new Set(
    result.rows
      .map((row) => row.base_name)
      .filter(Boolean),
  )]
    .sort((left, right) => compareCadTextBaseNames(fileType, left, right))
    .join(',');
  await db.query(
    `UPDATE components SET ${column} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [textValue, componentId],
  );
}

/**
 * Regenerate all TEXT columns for a component.
 */
export async function regenerateAllCadText(componentId, db = pool) {
  for (const fileType of Object.keys(FILE_TYPE_TO_COLUMN)) {
    await regenerateCadText(componentId, fileType, db);
  }
}

/**
 * Register a CAD file in the cad_files table.
 * Returns the cad_file record (existing or newly created).
 */
export async function registerCadFile(fileName, fileType, fileSize = null, db = pool) {
  const result = await db.query(`
    INSERT INTO cad_files (file_name, file_type, file_path, file_size, missing)
    VALUES ($1, $2, $3, $4, FALSE)
    ON CONFLICT (file_name, file_type) DO UPDATE SET
      file_size = COALESCE(EXCLUDED.file_size, cad_files.file_size),
      missing = FALSE,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [fileName, fileType, `${TYPE_SUBDIR[fileType]}/${fileName}`, fileSize]);
  return result.rows[0];
}

/**
 * Link a CAD file to a component.
 * Inserts junction record and regenerates the TEXT column.
 */
export async function linkCadFileToComponent(cadFileId, componentId, fileType, fileName, db = pool) {
  await db.query(`
    INSERT INTO component_cad_files (component_id, cad_file_id)
    VALUES ($1, $2)
    ON CONFLICT (component_id, cad_file_id) DO NOTHING
  `, [componentId, cadFileId]);

  const linkedCadFiles = [{ id: cadFileId, file_name: fileName, file_type: fileType }];

  await regenerateCadText(componentId, fileType, db);

  return linkedCadFiles;
}

/**
 * Link a CAD file to a component by manufacturer part number.
 * Used during file upload when we only have the MPN.
 */
export async function linkCadFileToComponentByMPN(cadFileId, mfgPartNumber, fileType, fileName, db = pool) {
  const compResult = await db.query(`
    SELECT id FROM components WHERE manufacturer_pn = $1
  `, [mfgPartNumber]);

  if (compResult.rows.length === 0) return null;

  const componentId = compResult.rows[0].id;
  await linkCadFileToComponent(cadFileId, componentId, fileType, fileName, db);
  return componentId;
}

/**
 * Unlink a CAD file from a component.
 * Removes junction record and regenerates TEXT column.
 */
export async function unlinkCadFileFromComponent(cadFileId, componentId, fileType, _fileName, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockDirectCadComponent(client, componentId, user);
    await client.query(`
      DELETE FROM component_cad_files
      WHERE component_id = $1 AND cad_file_id = $2
    `, [componentId, cadFileId]);
    await regenerateCadText(componentId, fileType, client);
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* original error wins */ }
    throw error;
  } finally {
    client.release();
  }
}

// Route middleware is only an early check. Hold current policy stable through
// the junction change and derived TEXT writes, including concurrent requests.
export async function lockDirectCadComponent(client, componentId, user) {
  const result = await client.query('SELECT id, approval_status FROM components WHERE id = $1 FOR UPDATE', [componentId]);
  const component = result.rows[0];
  if (!component) throw Object.assign(new Error('Component not found'), { status: 404 });
  if (isEcoEnabled() && !canDirectEditComponentInEcoMode({
    role: user?.role, currentApprovalStatus: component.approval_status,
  })) {
    throw Object.assign(new Error('Direct CAD edits require ECO approval unless the part is still in new status'), { status: 403 });
  }
  return component;
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
  return filterTrackableCadRows(result.rows, fileType);
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
 * Returns true when two existing paths resolve to the same physical file.
 * Used to allow case-only renames on case-insensitive filesystems (e.g. Windows)
 * where the source and target compare equal on disk.
 */
export function isSameExistingFile(firstPath, secondPath) {
  try {
    const firstStat = fs.statSync(firstPath);
    const secondStat = fs.statSync(secondPath);
    return firstStat.dev === secondStat.dev && firstStat.ino === secondStat.ino;
  } catch {
    return false;
  }
}

/**
 * Rename a CAD file (physical + database) atomically.
 * The physical rename, cad_files update, and TEXT-column regeneration run inside
 * a single transaction; if any step fails the DB rolls back and the physical
 * rename is reverted (best effort), so disk and DB never drift apart.
 *
 * `canonicalize: false` is for callers restoring a previous name (Filename
 * Sanitization unwinding a half-renamed footprint pair): re-resolving the
 * catalog there would map the old name straight back onto the name being
 * undone.
 */
export async function renameCadFile(cadFileId, newFileName, { canonicalize = true, user } = {}) {
  let catalog = [];
  if (canonicalize) {
    try { catalog = await listPackages(); } catch (error) {
      logError('CadFile', `Failed to load package catalog: ${error.message}`);
    }
  }
  const client = await pool.connect();
  let physicalRenamed = null;
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const cfResult = await client.query('SELECT * FROM cad_files WHERE id = $1 FOR UPDATE', [cadFileId]);

    if (cfResult.rows.length === 0) {
      throw new Error('CAD file not found');
    }

    const cadFile = cfResult.rows[0];
    const oldFileName = assertSafeLeafName(cadFile.file_name, 'fileName');
    const subdir = TYPE_SUBDIR[cadFile.file_type];
    let safeNewFileName = assertSafeLeafName(newFileName, 'newFileName');

    if (canonicalize && isCanonicalPackageFileType(cadFile.file_type)) {
      safeNewFileName = canonicalizeCadUploadFilename(safeNewFileName, cadFile.file_type, catalog);
    }

    if (!subdir) throw new Error(`Invalid file type: ${cadFile.file_type}`);

    const oldPath = resolvePathWithinBase(LIBRARY_BASE, subdir, oldFileName);
    const newPath = resolvePathWithinBase(LIBRARY_BASE, subdir, safeNewFileName);
    const isRename = safeNewFileName !== oldFileName;

    // Collision check (skip when the target is the same physical file, e.g. a
    // case-only rename on a case-insensitive filesystem).
    if (isRename && fs.existsSync(newPath) && !isSameExistingFile(oldPath, newPath)) {
      throw new Error(`File "${safeNewFileName}" already exists in the ${cadFile.file_type} directory`);
    }

    // Lock the file before reading its consumers: new FK links wait until the
    // rename commits, then derive TEXT from the committed filename.
    const affectedResult = await client.query(`
      SELECT c.id, c.approval_status FROM components c
      JOIN component_cad_files ccf ON ccf.component_id = c.id
      WHERE ccf.cad_file_id = $1 ORDER BY c.id FOR UPDATE OF c
    `, [cadFileId]);
    const affectedComponents = affectedResult.rows;
    if (user && isEcoEnabled() && affectedComponents.some(component => !canDirectEditComponentInEcoMode({
      role: user.role, currentApprovalStatus: component.approval_status,
    }))) {
      throw Object.assign(new Error('Renaming files used by controlled parts requires ECO approval'), { status: 403 });
    }

    if (isRename && fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      physicalRenamed = { oldPath, newPath };
    }

    await client.query(`
      UPDATE cad_files
      SET file_name = $1, file_path = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [safeNewFileName, `${subdir}/${safeNewFileName}`, cadFileId]);

    for (const comp of affectedComponents) {
      await regenerateCadText(comp.id, cadFile.file_type, client);
    }

    await client.query('COMMIT');
    transactionStarted = false;

    return { oldFileName, newFileName: safeNewFileName, fileType: cadFile.file_type };
  } catch (error) {
    if (physicalRenamed && fs.existsSync(physicalRenamed.newPath)) {
      try { fs.renameSync(physicalRenamed.newPath, physicalRenamed.oldPath); } catch { /* best-effort revert */ }
    }
    if (transactionStarted) {
      try { await client.query('ROLLBACK'); } catch { /* original error wins */ }
    }
    throw error;
  } finally {
    client.release();
  }
}

// Reuse the same definition for orphan discovery and the locked delete check.
const CAD_FILE_IN_USE_SQL = `
  EXISTS (SELECT 1 FROM component_cad_files ccf WHERE ccf.cad_file_id = cf.id)
  OR EXISTS (
    SELECT 1 FROM eco_cad_files ecf JOIN eco_orders eo ON eo.id = ecf.eco_id
    WHERE ecf.cad_file_id = cf.id AND eo.status IN ('pending', 'in_review')
  )
  OR EXISTS (
    SELECT 1 FROM eco_file_rename_files erf JOIN eco_orders eo ON eo.id = erf.eco_id
    WHERE erf.cad_file_id = cf.id AND eo.status IN ('pending', 'in_review')
  )
`;

/**
 * Delete unused CAD files as a group. Lock every parent row before rechecking
 * references: FK key-share locks serialize concurrent component/ECO inserts.
 * No live junction or active staging row may be cascaded away by this operation.
 * Unlink disk files only after commit; failures leave recoverable disk orphans.
 */
export async function deleteCadFiles(cadFileIds) {
  const ids = uniqueValues(cadFileIds);
  if (ids.length === 0) return [];
  const client = await pool.connect();
  let files;
  try {
    await client.query('BEGIN');
    const locked = await client.query('SELECT * FROM cad_files WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [ids]);
    if (locked.rows.length !== ids.length) {
      throw Object.assign(new Error('CAD file not found'), { status: 404 });
    }
    files = locked.rows.map((file) => ({
      fileName: assertSafeLeafName(file.file_name, 'fileName'),
      fileType: file.file_type,
      filePath: resolvePathWithinBase(LIBRARY_BASE, TYPE_SUBDIR[file.file_type], file.file_name),
      linkedComponents: [],
    }));
    // Separate statement obtains a fresh READ COMMITTED snapshot after lock waits.
    const inUse = await client.query(`SELECT cf.id FROM cad_files cf
      WHERE cf.id = ANY($1::uuid[]) AND (${CAD_FILE_IN_USE_SQL})`, [ids]);
    if (inUse.rows.length > 0) {
      throw Object.assign(new Error('Files linked to components or active ECOs cannot be deleted from File Library'), { status: 409 });
    }
    await client.query('DELETE FROM cad_files WHERE id = ANY($1::uuid[])', [ids]);
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* original error wins */ }
    throw error;
  } finally {
    client.release();
  }

  for (const file of files) {
    if (fs.existsSync(file.filePath)) fs.unlinkSync(file.filePath);
  }
  return files.map(({ filePath: _filePath, ...file }) => file);
}

export async function deleteCadFile(cadFileId) {
  return (await deleteCadFiles([cadFileId]))[0];
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
    WHERE NOT (${CAD_FILE_IN_USE_SQL})
  `;
  const params = [];

  if (fileType) {
    query += ' AND cf.file_type = $1';
    params.push(fileType);
  }

  query += ' ORDER BY cf.file_type, cf.file_name';

  const result = await pool.query(query, params);
  return filterTrackableCadRows(result.rows, fileType);
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
  return filterTrackableCadRows(result.rows, fileType);
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
  for (const row of filterTrackableCadRows(result.rows)) {
    if (!grouped[row.file_type]) grouped[row.file_type] = [];
    grouped[row.file_type].push(row);
  }
  return grouped;
}

export async function getCadFilesByIds(cadFileIds, db = pool) {
  const normalizedIds = uniqueValues(cadFileIds);
  if (normalizedIds.length === 0) {
    return [];
  }

  const result = await db.query(`
    SELECT id, file_name, file_type, file_size, missing
    FROM cad_files
    WHERE id = ANY($1::uuid[])
    ORDER BY file_type, file_name
  `, [normalizedIds]);

  return result.rows;
}

export async function linkCadFilesToComponentByIds(componentId, cadFileIds, db = pool) {
  const cadFiles = await getCadFilesByIds(cadFileIds, db);

  for (const cadFile of cadFiles) {
    await db.query(`
      INSERT INTO component_cad_files (component_id, cad_file_id)
      VALUES ($1, $2)
      ON CONFLICT (component_id, cad_file_id) DO NOTHING
    `, [componentId, cadFile.id]);
  }

  return cadFiles;
}

export async function getCadFilesByNames(fileNames, fileType, db = pool) {
  const normalizedFileNames = uniqueValues(fileNames);
  if (!fileType || normalizedFileNames.length === 0) {
    return [];
  }

  const result = await db.query(`
    SELECT id, file_name, file_type, file_size, missing
    FROM cad_files
    WHERE file_type = $1
      AND file_name = ANY($2::text[])
    ORDER BY file_name
  `, [fileType, normalizedFileNames]);

  return result.rows;
}

export async function getLinkedCadFilesMap(cadFileIds, db = pool) {
  const normalizedIds = uniqueValues(cadFileIds);
  const relatedFilesByCadFileId = new Map();

  if (normalizedIds.length === 0) {
    return relatedFilesByCadFileId;
  }

  const result = await db.query(`
    SELECT
      selected.id AS selected_cad_file_id,
      related.id,
      related.file_name,
      related.file_type,
      related.file_size,
      related.missing
    FROM cad_files selected
    JOIN footprint_related_cad_files frcf
      ON (
        (selected.file_type = 'footprint' AND frcf.footprint_cad_file_id = selected.id)
        OR (
          selected.file_type IN ('pad', 'model')
          AND frcf.related_cad_file_id = selected.id
          AND frcf.related_file_type = selected.file_type
        )
      )
    JOIN cad_files related
      ON (
        (selected.file_type = 'footprint' AND related.id = frcf.related_cad_file_id)
        OR (selected.file_type IN ('pad', 'model') AND related.id = frcf.footprint_cad_file_id)
      )
    WHERE selected.id = ANY($1::uuid[])
    ORDER BY related.file_type, related.file_name
  `, [normalizedIds]);

  for (const row of result.rows) {
    if (!relatedFilesByCadFileId.has(row.selected_cad_file_id)) {
      relatedFilesByCadFileId.set(row.selected_cad_file_id, []);
    }

    const relatedFiles = relatedFilesByCadFileId.get(row.selected_cad_file_id);
    if (!relatedFiles.some((file) => file.id === row.id)) {
      relatedFiles.push({
        id: row.id,
        file_name: row.file_name,
        file_type: row.file_type,
        file_size: row.file_size,
        missing: row.missing,
      });
    }
  }

  return relatedFilesByCadFileId;
}

export async function getLinkedCadFiles(cadFileIds, db = pool) {
  const relatedFilesByCadFileId = await getLinkedCadFilesMap(cadFileIds, db);
  const uniqueFiles = new Map();

  for (const relatedFiles of relatedFilesByCadFileId.values()) {
    relatedFiles.forEach((file) => {
      uniqueFiles.set(file.id, file);
    });
  }

  return [...uniqueFiles.values()];
}

export async function linkFootprintRelatedCadFiles({ footprintCadFileIds, relatedCadFileIds }, db = pool) {
  const normalizedFootprintIds = uniqueValues(footprintCadFileIds);
  const normalizedRelatedIds = uniqueValues(relatedCadFileIds);

  if (normalizedFootprintIds.length === 0 || normalizedRelatedIds.length === 0) {
    return [];
  }

  const cadFiles = await getCadFilesByIds([...normalizedFootprintIds, ...normalizedRelatedIds], db);
  const cadFileById = new Map(cadFiles.map((file) => [file.id, file]));

  for (const footprintCadFileId of normalizedFootprintIds) {
    const cadFile = cadFileById.get(footprintCadFileId);
    if (!cadFile || cadFile.file_type !== 'footprint') {
      throw new Error('Footprint-related links require footprint CAD file ids');
    }
  }

  let relatedFileType = null;
  for (const relatedCadFileId of normalizedRelatedIds) {
    const cadFile = cadFileById.get(relatedCadFileId);
    if (!cadFile || !FOOTPRINT_RELATED_FILE_TYPES.includes(cadFile.file_type)) {
      throw new Error('Footprint-related links require pad or model CAD file ids');
    }

    if (relatedFileType && relatedFileType !== cadFile.file_type) {
      throw new Error('Footprint-related links require matching related CAD file types');
    }

    relatedFileType = cadFile.file_type;
  }

  const createdLinks = [];
  for (const footprintCadFileId of normalizedFootprintIds) {
    for (const relatedCadFileId of normalizedRelatedIds) {
      await db.query(`
        INSERT INTO footprint_related_cad_files (
          footprint_cad_file_id,
          related_cad_file_id,
          related_file_type
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (footprint_cad_file_id, related_cad_file_id) DO NOTHING
      `, [footprintCadFileId, relatedCadFileId, relatedFileType]);

      createdLinks.push({
        footprint_cad_file_id: footprintCadFileId,
        related_cad_file_id: relatedCadFileId,
        related_file_type: relatedFileType,
      });
    }
  }

  return createdLinks;
}

export async function unlinkFootprintRelatedCadFiles({ footprintCadFileIds, relatedCadFileIds }, db = pool) {
  const normalizedFootprintIds = uniqueValues(footprintCadFileIds);
  const normalizedRelatedIds = uniqueValues(relatedCadFileIds);

  if (normalizedFootprintIds.length === 0 || normalizedRelatedIds.length === 0) {
    return 0;
  }

  let removedCount = 0;
  for (const footprintCadFileId of normalizedFootprintIds) {
    for (const relatedCadFileId of normalizedRelatedIds) {
      const result = await db.query(`
        DELETE FROM footprint_related_cad_files
        WHERE footprint_cad_file_id = $1 AND related_cad_file_id = $2
      `, [footprintCadFileId, relatedCadFileId]);

      removedCount += result.rowCount || 0;
    }
  }

  return removedCount;
}

export async function autoLinkRelatedCadFilesForComponent(componentId, db = pool) {
  const componentCadFiles = await getComponentFootprintRelatedFiles(componentId, db);
  const summary = summarizeFootprintRelatedCadFiles(componentCadFiles);

  if (summary.footprintCadFileIds.length === 0 || !isSimpleFootprintAutoLinkCandidate(componentCadFiles)) {
    return [];
  }

  const existingRelatedIds = new Set(
    componentCadFiles
      .filter((file) => FOOTPRINT_RELATED_FILE_TYPES.includes(file.file_type))
      .map((file) => file.id),
  );
  const existingRelatedTypes = new Set(
    componentCadFiles
      .filter((file) => FOOTPRINT_RELATED_FILE_TYPES.includes(file.file_type))
      .map((file) => file.file_type),
  );

  const relatedFilesByCadFileId = await getLinkedCadFilesMap(summary.footprintCadFileIds, db);
  const relatedCandidatesByType = new Map(
    FOOTPRINT_RELATED_FILE_TYPES.map((fileType) => [fileType, new Map()]),
  );

  for (const relatedFiles of relatedFilesByCadFileId.values()) {
    for (const relatedFile of relatedFiles) {
      if (
        !FOOTPRINT_RELATED_FILE_TYPES.includes(relatedFile.file_type)
        || relatedFile.missing
        || existingRelatedIds.has(relatedFile.id)
      ) {
        continue;
      }

      relatedCandidatesByType.get(relatedFile.file_type)?.set(relatedFile.id, relatedFile);
    }
  }

  const addedRelatedFiles = [];
  for (const relatedFileType of FOOTPRINT_RELATED_FILE_TYPES) {
    if (existingRelatedTypes.has(relatedFileType)) {
      continue;
    }

    const candidates = [...(relatedCandidatesByType.get(relatedFileType)?.values() || [])];
    if (candidates.length !== 1) {
      continue;
    }

    const relatedFile = candidates[0];
    await db.query(`
      INSERT INTO component_cad_files (component_id, cad_file_id)
      VALUES ($1, $2)
      ON CONFLICT (component_id, cad_file_id) DO NOTHING
    `, [componentId, relatedFile.id]);

    existingRelatedIds.add(relatedFile.id);
    addedRelatedFiles.push(relatedFile);
  }

  return addedRelatedFiles;
}

export async function syncFootprintRelatedCadFilesForComponent(componentId, db = pool) {
  const componentCadFiles = await getComponentFootprintRelatedFiles(componentId, db);
  const summary = summarizeFootprintRelatedCadFiles(componentCadFiles);

  if (summary.footprintCadFileIds.length === 0 || !isSimpleFootprintAutoLinkCandidate(componentCadFiles)) {
    return [];
  }

  const existingRelatedFilesByCadFileId = await getLinkedCadFilesMap(summary.footprintCadFileIds, db);
  const existingRelatedTypes = new Set();
  for (const relatedFiles of existingRelatedFilesByCadFileId.values()) {
    for (const relatedFile of relatedFiles) {
      if (FOOTPRINT_RELATED_FILE_TYPES.includes(relatedFile.file_type)) {
        existingRelatedTypes.add(relatedFile.file_type);
      }
    }
  }

  const createdLinks = [];

  for (const relatedFileType of FOOTPRINT_RELATED_FILE_TYPES) {
    if (existingRelatedTypes.has(relatedFileType)) {
      continue;
    }

    const relatedCadFiles = summary.relatedCadFilesByType.get(relatedFileType) || [];
    if (relatedCadFiles.length !== 1) {
      continue;
    }

    const relatedLinks = await linkFootprintRelatedCadFiles({
      footprintCadFileIds: summary.footprintCadFileIds,
      relatedCadFileIds: [relatedCadFiles[0].id],
    }, db);
    createdLinks.push(...relatedLinks);
  }

  return createdLinks;
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

// Extension whitelist per file type (used by filesystem scan)
const SCAN_CATEGORIES = {
  footprint: {
    extensions: ['.brd', '.kicad_mod', '.lbr', ...FOOTPRINT_PRIMARY_EXTENSIONS, '.fsm', '.bxl', FOOTPRINT_SECONDARY_EXTENSION],
    subdir: 'footprint',
    fileType: 'footprint',
  },
  symbol: {
    extensions: ['.olb', '.lib', '.kicad_sym', '.schlib'],
    subdir: 'symbol',
    fileType: 'symbol',
  },
  model: {
    extensions: MODEL_FILE_EXTENSIONS,
    subdir: 'model',
    fileType: 'model',
  },
  pspice: {
    extensions: PSPICE_FILE_EXTENSIONS,
    subdir: 'pspice',
    fileType: 'pspice',
  },
  pad: {
    extensions: ['.pad', '.plb'],
    subdir: 'pad',
    fileType: 'pad',
  },
};

export function isTrackableCadFile(fileName, fileType) {
  if (!fileName || !fileType) {
    return false;
  }

  const extension = path.extname(String(fileName)).toLowerCase();
  return SCAN_CATEGORIES[fileType]?.extensions.includes(extension) || false;
}

/**
 * Scan library directories for untracked CAD files and register them in the database.
 * Returns the number of newly registered files.
 */
export async function scanAndRegisterFiles() {
  let totalRegistered = 0;
  for (const [, config] of Object.entries(SCAN_CATEGORIES)) {
    const dirPath = path.join(LIBRARY_BASE, config.subdir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter((fileName) => (
      !fileName.startsWith('.') && isTrackableCadFile(fileName, config.fileType)
    ));
    for (const filename of files) {
      const existing = await findCadFile(filename, config.fileType);
      if (!existing) {
        try {
          await registerCadFile(filename, config.fileType);
          totalRegistered++;
        } catch (e) {
          logError('Scan', `Failed to register ${filename}: ${e.message}`);
        }
      }
    }
  }
  return totalRegistered;
}

/**
 * Detect files in the database that no longer exist on disk.
 * Tags missing files with missing=TRUE instead of deleting records.
 * Also clears the missing flag for files that have been restored to disk.
 * Returns the number of newly tagged missing records.
 */
export async function detectMissingFiles() {
  const result = await pool.query('SELECT id, file_name, file_type, missing FROM cad_files');
  let taggedCount = 0;
  let restoredCount = 0;

  for (const row of result.rows) {
    const subdir = TYPE_SUBDIR[row.file_type];
    if (!subdir) continue;

    const fullPath = path.join(LIBRARY_BASE, subdir, row.file_name);
    const existsOnDisk = fs.existsSync(fullPath);

    if (!existsOnDisk && !row.missing) {
      // File is missing from disk but not yet tagged — mark as missing
      await pool.query('UPDATE cad_files SET missing = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [row.id]);
      taggedCount++;
      logWarn('Scan', `Removed missing file: ${row.file_name} (${row.file_type})`);
    } else if (existsOnDisk && row.missing) {
      // File was previously missing but has been restored — clear the flag
      await pool.query('UPDATE cad_files SET missing = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [row.id]);
      restoredCount++;
      logInfo('Scan', `Restored file: ${row.file_name} (${row.file_type})`);
    }
  }

  if (restoredCount > 0) {
    logInfo('Scan', `Restored ${restoredCount} previously missing file(s)`);
  }
  return taggedCount;
}

/**
 * Sync CAD files from a component's data to the junction table.
 * Accepts arrays of base filenames (no extensions) from TEXT columns.
 * Matches against cad_files records which store full filenames (with extensions).
 * After syncing junction records, regenerates all TEXT columns.
 */
export async function syncComponentCadFiles(componentId, cadData, db = pool, options = {}) {
  const {
    allowFootprintAutoLink = false,
    allowFootprintHistoryLearning = false,
  } = options;

  // cadData: { pcb_footprint: [], schematic: [], step_model: [], pspice: [], pad_file: [] }
  const columnToFileType = {
    pcb_footprint: 'footprint',
    schematic: 'symbol',
    step_model: 'model',
    pspice: 'pspice',
    pad_file: 'pad',
  };

  // Get current junction links (full filenames from cad_files)
  const currentLinks = await db.query(`
    SELECT ccf.id, cf.id as cad_file_id, cf.file_name, cf.file_type
    FROM component_cad_files ccf
    JOIN cad_files cf ON ccf.cad_file_id = cf.id
    WHERE ccf.component_id = $1
  `, [componentId]);

  // Build desired base names per file type (lowercase for case-insensitive matching)
  const desiredBaseNames = {};
  for (const [column, fileType] of Object.entries(columnToFileType)) {
    const names = cadData[column] || [];
    desiredBaseNames[fileType] = new Set(
      (Array.isArray(names) ? names : []).filter(n => n && typeof n === 'string').map(n => n.toLowerCase()),
    );
  }

  // Remove junction records where the base name is no longer desired for that file type
  for (const row of currentLinks.rows) {
    const baseName = row.file_name.replace(/\.[^.]+$/, '').toLowerCase();
    const desired = desiredBaseNames[row.file_type];
    if (desired && !desired.has(baseName)) {
      await db.query('DELETE FROM component_cad_files WHERE id = $1', [row.id]);
    }
  }

  // Build set of already-linked base names per file type
  const linkedBaseNames = {};
  for (const row of currentLinks.rows) {
    const baseName = row.file_name.replace(/\.[^.]+$/, '').toLowerCase();
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

      // Find ALL existing cad_files by base name pattern match (case-insensitive).
      // This keeps footprint pairs linked together for either .psm/.dra or .bsm/.dra.
      const matches = await db.query(`
        SELECT id FROM cad_files
        WHERE file_type = $1 AND LOWER(regexp_replace(file_name, '\\.[^.]+$', '')) = LOWER($2)
      `, [fileType, baseName]);

      for (const match of matches.rows) {
        await db.query(`
          INSERT INTO component_cad_files (component_id, cad_file_id)
          VALUES ($1, $2)
          ON CONFLICT (component_id, cad_file_id) DO NOTHING
        `, [componentId, match.id]);
      }
    }
  }

  if (allowFootprintAutoLink) {
    await autoLinkRelatedCadFilesForComponent(componentId, db);
  }
  await regenerateAllCadText(componentId, db);
  if (allowFootprintHistoryLearning) {
    await syncFootprintRelatedCadFilesForComponent(componentId, db);
  }
}

/**
 * Get components with their CAD file counts, optionally filtered to one
 * category. Used for the Category / "All Categories" views in the File
 * Library page.
 */
export async function getComponentsWithCadFiles(categoryId = null) {
  const result = await pool.query(`
    SELECT
      c.id,
      c.part_number,
      c.manufacturer_pn,
      c.description,
      c.value,
      c.package_size,
      m.name as manufacturer_name,
      cat.name as category_name,
      COUNT(ccf.id) as cad_file_count
    FROM components c
    LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
    LEFT JOIN component_categories cat ON c.category_id = cat.id
    LEFT JOIN component_cad_files ccf ON c.id = ccf.component_id
    WHERE $1::uuid IS NULL OR c.category_id = $1
    GROUP BY c.id, m.name, cat.name
    ORDER BY c.part_number ASC
  `, [categoryId]);
  return result.rows;
}

/**
 * Get the CAD files of one type linked to a component by manufacturer PN.
 * Shared by the part-page file list and the file export ZIP.
 */
export async function getComponentCadFilesByMPN(mfgPartNumber, fileType) {
  const result = await pool.query(`
    SELECT cf.id, cf.file_name, cf.file_type, cf.missing
    FROM component_cad_files ccf
    JOIN cad_files cf ON ccf.cad_file_id = cf.id
    JOIN components c ON ccf.component_id = c.id
    WHERE c.manufacturer_pn = $1 AND cf.file_type = $2
  `, [mfgPartNumber, fileType]);
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
  lockDirectCadComponent,
  getCadFilesByType,
  getComponentsByCadFile,
  getComponentsByFileName,
  renameCadFile,
  deleteCadFile,
  deleteCadFiles,
  getOrphanCadFiles,
  searchCadFiles,
  getCadFilesForComponentGrouped,
  getCadFilesByIds,
  linkCadFilesToComponentByIds,
  getCadFilesByNames,
  getLinkedCadFilesMap,
  getLinkedCadFiles,
  linkFootprintRelatedCadFiles,
  unlinkFootprintRelatedCadFiles,
  autoLinkRelatedCadFilesForComponent,
  syncFootprintRelatedCadFilesForComponent,
  findCadFile,
  isTrackableCadFile,
  isSameExistingFile,
  scanAndRegisterFiles,
  detectMissingFiles,
  syncComponentCadFiles,
  getComponentsWithCadFiles,
  getComponentCadFilesByMPN,
  getComponentsSharingFiles,
};
