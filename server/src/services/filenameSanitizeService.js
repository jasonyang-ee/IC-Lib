import {
  getCadFileBaseName,
  getCadFileExtension,
  isFootprintPrimaryExtension,
  normalizeCadUploadFilename,
  resolveCanonicalCadFilename,
} from '../utils/footprintFiles.js';
import { logInfo, logWarn } from '../utils/logger.js';
import { isTrackableCadFile, renameCadFile } from './cadFileService.js';

/** Typed confirmation the admin must supply before a run may start (SPEC V64). */
export const SANITIZE_CONFIRMATION_TOKEN = 'SANITIZE';

/** Filename Sanitization scope (SPEC V64): pad and pspice stay out. */
export const SANITIZE_FILE_TYPES = ['footprint', 'symbol', 'model'];

/** Closed set of skip reasons reported back to the admin (SPEC V64). */
export const SANITIZE_SKIP_REASONS = Object.freeze({
  NO_PACKAGE_INFO: 'no-package-info',
  NO_PIN_COUNT: 'no-pin-count',
  UNSUPPORTED_VARIANT: 'unsupported-variant',
  ALREADY_CANONICAL: 'already-canonical',
  COLLISION: 'collision',
  NOT_TRACKABLE: 'not-trackable',
  RENAME_FAILED: 'rename-failed',
});

const nameKey = (fileType, fileName) => `${fileType}:${String(fileName || '').toLowerCase()}`;

/**
 * Footprint pairs (.psm/.bsm plus .dra) share one base name and must move
 * together (SPEC V53), so they are planned as a single group.
 */
const groupKeyOf = (file) => (
  file.file_type === 'footprint'
    ? `footprint:${getCadFileBaseName(file.file_name).toLowerCase()}`
    : `${file.file_type}:${file.id}`
);

const groupFiles = (files) => {
  const groups = new Map();
  for (const file of files) {
    const key = groupKeyOf(file);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  }
  return groups;
};

const entryOf = (file, newName, action, reason) => ({
  cadFileId: file.id,
  groupKey: groupKeyOf(file),
  fileType: file.file_type,
  oldName: file.file_name,
  newName,
  action,
  reason,
});

/**
 * Classify every registered CAD file against the canonical package identity
 * (SPEC V61) without touching disk or database: the applier (F5.T2) owns the
 * atomic rename. The canonical name is derived from the file's own name only -
 * a linked component's package_size is never consulted (SPEC V64).
 */
export function planFilenameSanitization(files, catalog) {
  const inScope = (Array.isArray(files) ? files : [])
    .filter((file) => SANITIZE_FILE_TYPES.includes(file?.file_type));

  // Every registered name of the same type is claimed by its own group up
  // front, so a target already in use by another group is a collision.
  const claimedNames = new Map();
  for (const file of inScope) {
    claimedNames.set(nameKey(file.file_type, file.file_name), groupKeyOf(file));
  }

  const entries = [];
  for (const [groupKey, members] of groupFiles(inScope)) {
    const untrackable = members.filter((file) => !isTrackableCadFile(file.file_name, file.file_type));
    if (untrackable.length > 0) {
      entries.push(...members.map((file) => (
        entryOf(file, file.file_name, 'skip', SANITIZE_SKIP_REASONS.NOT_TRACKABLE)
      )));
      continue;
    }

    // A footprint pair takes its canonical base from the primary file; the .dra
    // follows it so the pair never splits.
    const source = members.find((file) => isFootprintPrimaryExtension(file.file_name)) || members[0];
    const resolved = resolveCanonicalCadFilename(source.file_name, source.file_type, catalog);
    const canonicalBaseName = getCadFileBaseName(resolved.fileName);

    const targets = members.map((file) => ({
      file,
      newName: normalizeCadUploadFilename(`${canonicalBaseName}${getCadFileExtension(file.file_name)}`),
    }));

    if (targets.every(({ file, newName }) => newName === file.file_name)) {
      entries.push(...targets.map(({ file }) => (
        entryOf(file, file.file_name, 'skip', resolved.reason || SANITIZE_SKIP_REASONS.ALREADY_CANONICAL)
      )));
      continue;
    }

    const collides = targets.some(({ file, newName }) => {
      const owner = claimedNames.get(nameKey(file.file_type, newName));
      return owner !== undefined && owner !== groupKey;
    });
    if (collides) {
      entries.push(...targets.map(({ file }) => (
        entryOf(file, file.file_name, 'skip', SANITIZE_SKIP_REASONS.COLLISION)
      )));
      continue;
    }

    for (const { file, newName } of targets) {
      claimedNames.set(nameKey(file.file_type, newName), groupKey);
      entries.push(newName === file.file_name
        ? entryOf(file, file.file_name, 'skip', SANITIZE_SKIP_REASONS.ALREADY_CANONICAL)
        : entryOf(file, newName, 'rename', null));
    }
  }

  return entries;
}

/**
 * Apply a plan through the atomic rename path (SPEC V25). A failure demotes its
 * whole group to a reported skip and the pass continues (SPEC V64); a footprint
 * pair that fails halfway is unwound so the pair never splits (SPEC V53).
 */
export async function applyFilenameSanitization(entries, { renameFile = renameCadFile } = {}) {
  const groups = new Map();
  for (const entry of entries) {
    if (entry.action !== 'rename') continue;
    if (!groups.has(entry.groupKey)) groups.set(entry.groupKey, []);
    groups.get(entry.groupKey).push(entry);
  }

  const failedGroups = new Set();
  for (const [groupKey, members] of groups) {
    const renamed = [];
    try {
      for (const entry of members) {
        await renameFile(entry.cadFileId, entry.newName);
        renamed.push(entry);
        logInfo('Sanitize', `${entry.oldName} -> ${entry.newName}`);
      }
    } catch (error) {
      failedGroups.add(groupKey);
      for (const entry of renamed.reverse()) {
        try {
          await renameFile(entry.cadFileId, entry.oldName, { canonicalize: false });
        } catch (revertError) {
          logWarn('Sanitize', `Failed to restore ${entry.newName} to ${entry.oldName}: ${revertError.message}`);
        }
      }
      logWarn('Sanitize', `skip ${members.map((entry) => entry.oldName).join(', ')} (${SANITIZE_SKIP_REASONS.RENAME_FAILED}: ${error.message})`);
    }
  }

  const results = entries.map((entry) => (
    entry.action === 'rename' && failedGroups.has(entry.groupKey)
      ? { ...entry, newName: entry.oldName, action: 'skip', reason: SANITIZE_SKIP_REASONS.RENAME_FAILED }
      : entry
  ));

  for (const entry of results) {
    if (entry.action === 'skip' && entry.reason !== SANITIZE_SKIP_REASONS.RENAME_FAILED) {
      logInfo('Sanitize', `skip ${entry.oldName} (${entry.reason})`);
    }
  }

  return results;
}

export default {
  SANITIZE_CONFIRMATION_TOKEN,
  SANITIZE_FILE_TYPES,
  SANITIZE_SKIP_REASONS,
  planFilenameSanitization,
  applyFilenameSanitization,
};
