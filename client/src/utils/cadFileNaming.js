import { isFootprintPairFile } from './footprintFiles';
import { parsePackageInput } from './packageNaming';

const DIMENSIONAL_NOTE_PATTERN = /\s*\((?=[^)]*(?:mm|cm|mil|inch|inches|width|height|length|pitch|dia|diameter|body|thick|od|id|["']))[^)]*\)\s*$/i;
const PACKAGE_ALIAS_SEPARATOR = /[;,]/;

export const extractPackageLabel = (packageSize) => {
  if (!packageSize || typeof packageSize !== 'string') return '';

  let normalized = packageSize.trim();
  while (DIMENSIONAL_NOTE_PATTERN.test(normalized)) {
    normalized = normalized.replace(DIMENSIONAL_NOTE_PATTERN, '').trim();
  }

  return normalized.split(PACKAGE_ALIAS_SEPARATOR)[0].trim();
};

export const formatPackageFilenameBase = (packageSize) => (
  extractPackageLabel(packageSize)
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
);

export const extractCadDensitySuffix = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return { base: '', suffix: '', ext: '' };
  }

  const lastDotIndex = filename.lastIndexOf('.');
  const ext = lastDotIndex >= 0 ? filename.slice(lastDotIndex) : '';
  const baseName = lastDotIndex >= 0 ? filename.slice(0, lastDotIndex) : filename;
  const parsed = parsePackageInput(baseName);

  if (!parsed?.density) {
    return { base: baseName, suffix: '', ext };
  }

  return {
    base: baseName.slice(0, -2),
    suffix: `_${parsed.density.toLowerCase()}`,
    ext,
  };
};

export const buildCadShortcutFilename = (currentFilename, renamedBase) => {
  const { suffix, ext } = extractCadDensitySuffix(currentFilename);
  const normalizedExtension = ext.toLowerCase();
  const normalizedBase = isFootprintPairFile(`file${normalizedExtension}`) ? String(renamedBase || '').toLowerCase() : renamedBase;
  return `${normalizedBase}${suffix}${normalizedExtension}`;
};
