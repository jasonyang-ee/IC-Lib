const DIMENSIONAL_NOTE_PATTERN = /\s*\((?=[^)]*(?:mm|cm|mil|inch|inches|width|height|length|pitch|dia|diameter|body|thick|od|id|["']))[^)]*\)\s*$/i;
const PACKAGE_ALIAS_SEPARATOR = /[;,]/;
const CAD_DENSITY_SUFFIX_PATTERN = /^(.*?)([_-][lmn])$/i;

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
  const match = baseName.match(CAD_DENSITY_SUFFIX_PATTERN);

  if (!match) {
    return { base: baseName, suffix: '', ext };
  }

  return {
    base: match[1],
    suffix: `${match[2].charAt(0)}${match[2].charAt(1).toLowerCase()}`,
    ext,
  };
};

export const buildCadShortcutFilename = (currentFilename, renamedBase) => {
  const { suffix, ext } = extractCadDensitySuffix(currentFilename);
  return `${renamedBase}${suffix}${ext}`;
};