import { isFootprintPairFile } from './footprintFiles';
import { buildCanonicalName, parsePackageInput } from './packageNaming';

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

/**
 * Keep unknown package text usable while promoting catalog-resolved package
 * names to the same canonical base the server stores.
 */
export const formatCanonicalPackageFilenameBase = (packageSize, resolution) => {
  const packageRow = resolution?.package;
  const canonicalName = packageRow && buildCanonicalName({
    shortName: packageRow.short_name,
    pinCount: resolution.pinCount,
    countPolicy: packageRow.count_policy,
  });

  return canonicalName || formatPackageFilenameBase(resolution?.input || packageSize);
};

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

export const buildCadShortcutFilename = (currentFilename, renamedBase, fileType) => {
  const { suffix, ext } = extractCadDensitySuffix(currentFilename);
  const normalizedExtension = ext.toLowerCase();
  const resolvedFileType = fileType || (isFootprintPairFile(`file${normalizedExtension}`) ? 'footprint' : '');
  const isFootprint = resolvedFileType === 'footprint' || isFootprintPairFile(`file${normalizedExtension}`);
  const isSymbolOrModel = resolvedFileType === 'symbol' || resolvedFileType === 'model';
  const normalizedBase = isFootprint
    ? String(renamedBase || '').toLowerCase()
    : isSymbolOrModel
      ? String(renamedBase || '').toUpperCase()
      : String(renamedBase || '');
  const normalizedSuffix = isSymbolOrModel ? suffix.toUpperCase() : suffix;

  return `${normalizedBase}${normalizedSuffix}${normalizedExtension}`;
};

/**
 * Display-only formatting (SPEC V63): footprints are stored all-lowercase, so
 * render the whole base uppercase — a custom `max17761atp.psm` reads
 * `MAX17761ATP.psm`. This is a pure case transform, so the displayed name
 * differs from the stored one by case alone and a reader can always map it
 * back to disk; a legacy density letter is uppercased, never remapped
 * (`_m` shows as `_M`, not `_A`). Symbol and model bases keep their input
 * case. Every CAD extension shows lowercase even on a legacy row that still
 * holds `.STEP`. Never send the result to a write path, a collision check,
 * or a rename payload.
 *
 * A name with no extension (a TEXT-column value or a footprint pair base)
 * cannot be sniffed, so pass `fileType` wherever the caller knows it.
 */
export const formatCadFileDisplayName = (fileName, fileType) => {
  const name = typeof fileName === 'string' ? fileName : '';
  if (!name) return name;

  const lastDotIndex = name.lastIndexOf('.');
  const base = lastDotIndex >= 0 ? name.slice(0, lastDotIndex) : name;
  const ext = lastDotIndex >= 0 ? name.slice(lastDotIndex).toLowerCase() : '';

  const displayBase = fileType === 'footprint' || isFootprintPairFile(name)
    ? base.toUpperCase()
    : base;

  return `${displayBase}${ext}`;
};
