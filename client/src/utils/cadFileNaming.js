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