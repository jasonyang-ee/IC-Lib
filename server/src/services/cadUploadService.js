import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import cadFileService from './cadFileService.js';
import { canDirectEditComponentInEcoMode } from './componentLifecycleService.js';
import { isEcoEnabled } from '../utils/featureFlags.js';
import { assertSafeLeafName } from '../utils/safeFsPaths.js';
import { logError } from '../utils/logger.js';

const LIBRARY_BASE = fileURLToPath(new URL('../../../library/', import.meta.url));
const CATEGORIES = new Set(['footprint', 'symbol', 'model', 'pspice', 'pad']);
const reject = (message, status = 400) => Object.assign(new Error(message), { status });

// The component lock spans both policy evaluation and junction/TEXT writes.
// New-part creation and ECO staging omit both identities and only register files.
async function lockUploadComponent(client, { componentId, mfgPartNumber, user }) {
  if (!componentId && !mfgPartNumber) return null;
  const result = await client.query(`
    SELECT id, approval_status FROM components
    WHERE ${componentId ? 'id' : 'manufacturer_pn'} = $1 ORDER BY id FOR UPDATE
  `, [componentId || mfgPartNumber]);
  if (result.rows.length === 0) throw reject('Component not found', 404);
  if (result.rows.length !== 1) throw reject('Part number is ambiguous; select a component by ID', 409);
  const component = result.rows[0];
  if (isEcoEnabled() && !canDirectEditComponentInEcoMode({
    role: user?.role, currentApprovalStatus: component.approval_status,
  })) {
    throw reject('Direct CAD edits require ECO approval unless the part is still in new status', 403);
  }
  return component.id;
}

function cleanupFile(filename) {
  try { fs.unlinkSync(filename); } catch (error) {
    if (error.code !== 'ENOENT') logError('CadUpload', 'Failed to clean up completed upload:', error);
  }
}

/** Publish one upload, retaining its token and original target on failure. */
export async function finalizeCadUpload({ tempFilename, filename, category, resolution, componentId, mfgPartNumber, user }) {
  if (!CATEGORIES.has(category)) throw reject('Invalid CAD category');
  const safeFilename = assertSafeLeafName(filename, 'filename');
  const safeTempFilename = tempFilename ? assertSafeLeafName(tempFilename, 'tempFilename') : null;
  if (resolution && !['use_existing', 'overwrite'].includes(resolution)) throw reject('Invalid collision resolution');
  if (isEcoEnabled() && resolution === 'overwrite') {
    throw reject('Overwriting existing library files is not supported with ECO enabled', 403);
  }
  const targetPath = path.join(LIBRARY_BASE, category, safeFilename);
  const tempPath = safeTempFilename ? path.join(LIBRARY_BASE, 'temp', safeTempFilename) : null;
  const client = await pool.connect();
  let copied = false;
  let moved = false;
  let backupPath = null;
  let committed = false;
  try {
    await client.query('BEGIN');
    // Serializes finalization/restore of the same destination across requests.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`cad-upload:${category}:${safeFilename.toLowerCase()}`]);
    const targetComponentId = await lockUploadComponent(client, { componentId, mfgPartNumber, user });
    if (tempPath && !fs.existsSync(tempPath)) throw reject('Temp file not found', 404);
    // Hold the tracked row through disk publication too, so a tracked rename
    // cannot change its identity while this request publishes/links it.
    const cadFile = await cadFileService.registerCadFile(safeFilename, category, null, client);
    const targetExists = fs.existsSync(targetPath);
    if (resolution === 'use_existing') {
      if (!targetExists) throw reject('Existing library file not found', 404);
    } else {
      if (!tempPath) throw reject('Temp filename is required');
      if (targetExists && resolution !== 'overwrite') {
        throw reject('A file with this name already exists; choose use existing or overwrite', 409);
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      if (targetExists) {
        backupPath = path.join(LIBRARY_BASE, 'temp', `restore-${randomUUID()}`);
        fs.copyFileSync(targetPath, backupPath, fs.constants.COPYFILE_EXCL);
        // rename replaces atomically; never unlink the original before moving.
        fs.renameSync(tempPath, targetPath);
        moved = true;
      } else {
        fs.copyFileSync(tempPath, targetPath, fs.constants.COPYFILE_EXCL);
        copied = true;
      }
    }
    if (targetComponentId) {
      await cadFileService.linkCadFileToComponent(cadFile.id, targetComponentId, category, safeFilename, client);
    }
    await client.query('COMMIT');
    committed = true;
    if (tempPath && !moved) cleanupFile(tempPath);
    if (backupPath) cleanupFile(backupPath);
    return { filename: safeFilename, type: category, collision: resolution === 'use_existing', cadFileId: cadFile.id,
      ...(resolution === 'use_existing' ? { linked: Boolean(targetComponentId) } : {}) };
  } catch (error) {
    let failure = error;
    if (!committed) {
      // Restore disk before releasing the transaction's destination lock.
      try {
        if (moved) fs.renameSync(targetPath, tempPath);
        if (moved && backupPath) fs.renameSync(backupPath, targetPath);
        else if (backupPath) cleanupFile(backupPath);
        if (copied) fs.unlinkSync(targetPath);
      } catch (restoreError) {
        logError('CadUpload', 'Failed to restore upload files; retained temp/backup requires recovery:', restoreError);
        failure = reject('Upload failed and file recovery is incomplete; contact an administrator before retrying', 500);
      }
      try { await client.query('ROLLBACK'); } catch { /* original error wins */ }
    }
    throw failure;
  } finally {
    client.release();
  }
}
