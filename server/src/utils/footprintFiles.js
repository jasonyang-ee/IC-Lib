import path from 'path';
import { buildCanonicalName, foldAliasKey, isUnsupportedIpcVariant, parsePackageInput } from './packageNaming.js';

export const FOOTPRINT_PRIMARY_EXTENSIONS = ['.psm', '.bsm'];
export const FOOTPRINT_SECONDARY_EXTENSION = '.dra';
export const FOOTPRINT_FILE_EXTENSIONS = [...FOOTPRINT_PRIMARY_EXTENSIONS, FOOTPRINT_SECONDARY_EXTENSION];

export const FOOTPRINT_PLUS_ERROR_MESSAGE = '"+" is not allowed in OrCAD footprint names';

/** Typed error so controllers can map footprint-name violations to 422. */
export class FootprintNameError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FootprintNameError';
  }
}

export function getCadFileExtension(fileName) {
  return path.extname(String(fileName || '')).toLowerCase();
}

export function getCadFileBaseName(fileName) {
  const normalizedFileName = String(fileName || '');
  const extension = getCadFileExtension(normalizedFileName);
  return extension ? normalizedFileName.slice(0, -extension.length) : normalizedFileName;
}

export function isFootprintPrimaryExtension(fileNameOrExtension) {
  const normalized = String(fileNameOrExtension || '');
  const extension = normalized.startsWith('.') ? normalized.toLowerCase() : getCadFileExtension(normalized);
  return FOOTPRINT_PRIMARY_EXTENSIONS.includes(extension);
}

export function isFootprintSecondaryFile(fileName) {
  return getCadFileExtension(fileName) === FOOTPRINT_SECONDARY_EXTENSION;
}

export function isFootprintFileExtension(fileNameOrExtension) {
  const normalized = String(fileNameOrExtension || '');
  const extension = normalized.startsWith('.') ? normalized.toLowerCase() : getCadFileExtension(normalized);
  return FOOTPRINT_FILE_EXTENSIONS.includes(extension);
}

/**
 * Footprint filename rules (every input boundary; legacy on-disk names are
 * grandfathered): whole name lowercase, base has no dots (extension = the
 * last-dot segment, every other dot silently dropped). Non-footprint
 * extensions only get the lowercase extension.
 */
export function normalizeFootprintFilename(fileName) {
  const extension = getCadFileExtension(fileName);
  if (!extension) {
    return String(fileName || '');
  }

  let baseName = getCadFileBaseName(fileName);
  if (FOOTPRINT_FILE_EXTENSIONS.includes(extension)) {
    baseName = baseName.replace(/\./g, '').toLowerCase();
  }

  return `${baseName}${extension}`;
}

/**
 * Normalize a filename entering the CAD library (upload, ZIP extract, rename,
 * finalize): lowercase extension for every category, full footprint rules for
 * footprint extensions.
 */
export function normalizeCadUploadFilename(fileName) {
  return normalizeFootprintFilename(fileName);
}

const CANONICAL_PACKAGE_FILE_TYPES = new Set(['footprint', 'symbol', 'model']);

export function isCanonicalPackageFileType(fileType) {
  return CANONICAL_PACKAGE_FILE_TYPES.has(fileType);
}

const findCatalogPackage = (catalog, matchedAliasKey) => (
  (Array.isArray(catalog) ? catalog : []).find((packageRow) => (
    [packageRow?.short_name, ...(packageRow?.aliases || []).map((entry) => entry?.alias || entry)]
      .some((alias) => foldAliasKey(alias) === matchedAliasKey)
  )) || null
);

/**
 * Resolve a CAD filename through supplied package catalog rows before applying
 * existing storage rules. Callers load the catalog once per request so ZIPs
 * and batches do not issue one query per file.
 */
export function resolveCanonicalCadFilename(fileName, fileType, catalog) {
  const normalizedFilename = normalizeCadUploadFilename(fileName);
  const miss = (reason) => ({ fileName: normalizedFilename, reason });
  if (!isCanonicalPackageFileType(fileType)) return miss('not-canonical-type');

  const baseName = getCadFileBaseName(normalizedFilename);
  if (isUnsupportedIpcVariant(baseName)) return miss('unsupported-variant');

  const parsed = parsePackageInput(baseName, catalog);
  const packageRow = parsed && findCatalogPackage(catalog, parsed.matchedAliasKey);
  if (!packageRow) return miss('no-package-info');

  const canonicalBaseName = buildCanonicalName({
    shortName: packageRow.short_name,
    pinCount: parsed.pinCount,
    density: parsed.density,
    countPolicy: packageRow.count_policy,
  });
  if (!canonicalBaseName) return miss('no-pin-count');

  return {
    fileName: normalizeCadUploadFilename(`${canonicalBaseName}${getCadFileExtension(normalizedFilename)}`),
    reason: null,
  };
}

export function canonicalizeCadUploadFilename(fileName, fileType, catalog) {
  return resolveCanonicalCadFilename(fileName, fileType, catalog).fileName;
}

/** `+` is OrCAD-illegal in footprint names — reject, never silently strip. */
export function assertNoPlusInFootprintName(fileName) {
  if (String(fileName || '').includes('+')) {
    throw new FootprintNameError(FOOTPRINT_PLUS_ERROR_MESSAGE);
  }
  return fileName;
}

/** Shared base-name sanitize (no case/dot rules — those are footprint-only). */
export function sanitizeCadBaseName(baseName) {
  return String(baseName || '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function sanitizeFootprintBaseName(fileName) {
  let baseName = String(fileName || '');
  // Strip a trailing footprint extension if the caller passed a full filename
  if (isFootprintFileExtension(baseName)) {
    baseName = baseName.replace(/\.[^.]+$/, '');
  }
  return sanitizeCadBaseName(baseName).replace(/\./g, '').toLowerCase();
}

export function buildFootprintRenameTargets(fileNames, newBaseName) {
  const normalizedFileNames = [...new Set(
    (Array.isArray(fileNames) ? fileNames : [])
      .map((fileName) => String(fileName || '').trim())
      .filter(Boolean),
  )];

  if (normalizedFileNames.length !== 2) {
    throw new Error('Footprint pair rename requires exactly one primary file (.psm or .bsm) and one .dra file');
  }

  const primaryFiles = normalizedFileNames.filter((fileName) => isFootprintPrimaryExtension(fileName));
  const draFiles = normalizedFileNames.filter((fileName) => isFootprintSecondaryFile(fileName));
  if (primaryFiles.length !== 1 || draFiles.length !== 1) {
    throw new Error('Footprint pair rename requires one .psm or .bsm file and one .dra file');
  }

  const baseNames = new Set(normalizedFileNames.map((fileName) => getCadFileBaseName(fileName).toLowerCase()));
  if (baseNames.size !== 1) {
    throw new Error('Footprint pair rename requires matching base names for the primary file and .dra file');
  }

  assertNoPlusInFootprintName(newBaseName);

  const sanitizedBaseName = sanitizeFootprintBaseName(newBaseName);
  if (!sanitizedBaseName) {
    throw new Error('Invalid filename after sanitization');
  }

  return normalizedFileNames.map((oldFileName) => {
    const extension = getCadFileExtension(oldFileName);
    return {
      oldFileName,
      newFileName: normalizeFootprintFilename(`${sanitizedBaseName}${extension}`),
    };
  });
}
