import path from 'path';

export const FOOTPRINT_PRIMARY_EXTENSIONS = ['.psm', '.bsm'];
export const FOOTPRINT_SECONDARY_EXTENSION = '.dra';

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

export function normalizeFootprintFilenameCase(fileName) {
  const extension = getCadFileExtension(fileName);
  if (!extension) {
    return String(fileName || '');
  }

  const baseName = getCadFileBaseName(fileName);
  if (extension === '.psm') {
    return `${baseName.toLowerCase()}${extension}`;
  }

  return `${baseName}${extension}`;
}

export function sanitizeFootprintBaseName(fileName) {
  return String(fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
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

  const sanitizedBaseName = sanitizeFootprintBaseName(newBaseName);
  if (!sanitizedBaseName) {
    throw new Error('Invalid filename after sanitization');
  }

  return normalizedFileNames.map((oldFileName) => {
    const extension = getCadFileExtension(oldFileName);
    return {
      oldFileName,
      newFileName: normalizeFootprintFilenameCase(`${sanitizedBaseName}${extension}`),
    };
  });
}