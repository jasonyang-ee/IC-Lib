export const FOOTPRINT_PRIMARY_EXTENSIONS = ['.psm', '.bsm'];
export const FOOTPRINT_SECONDARY_EXTENSION = '.dra';
export const FOOTPRINT_PAIR_EXTENSIONS = [...FOOTPRINT_PRIMARY_EXTENSIONS, FOOTPRINT_SECONDARY_EXTENSION];

export const getCadFileExtension = (fileName) => {
  const normalizedFileName = String(fileName || '');
  const lastDotIndex = normalizedFileName.lastIndexOf('.');
  return lastDotIndex >= 0 ? normalizedFileName.slice(lastDotIndex).toLowerCase() : '';
};

export const getCadFileBaseName = (fileName) => {
  const extension = getCadFileExtension(fileName);
  return extension ? String(fileName || '').slice(0, -extension.length) : String(fileName || '');
};

export const normalizeFootprintGroupBase = (fileName) => getCadFileBaseName(fileName).toLowerCase();

export const isFootprintPrimaryExtension = (fileNameOrExtension) => {
  const normalized = String(fileNameOrExtension || '');
  const extension = normalized.startsWith('.') ? normalized.toLowerCase() : getCadFileExtension(normalized);
  return FOOTPRINT_PRIMARY_EXTENSIONS.includes(extension);
};

export const isFootprintSecondaryFile = (fileName) => getCadFileExtension(fileName) === FOOTPRINT_SECONDARY_EXTENSION;

export const isFootprintPairFile = (fileName) => FOOTPRINT_PAIR_EXTENSIONS.includes(getCadFileExtension(fileName));

export const FOOTPRINT_PLUS_ERROR_MESSAGE = '"+" is not allowed in OrCAD footprint names';

/**
 * Footprint filename rules (mirror of server `utils/footprintFiles.js`): whole
 * name lowercase, base has no dots (extension = the last-dot segment, every
 * other dot silently dropped). Non-footprint extensions only get the lowercase
 * extension.
 *
 * What must match the server is the behaviour at every supported user input
 * boundary (§V28), not the helper algorithm: this uses `lastIndexOf` while the
 * server uses `path.extname`, so the two can differ on synthetic inputs such as
 * a leading-dot name with no extension. Those are not reachable inputs.
 */
export const normalizeFootprintFilename = (fileName) => {
  const extension = getCadFileExtension(fileName);
  if (!extension) {
    return String(fileName || '');
  }

  let baseName = getCadFileBaseName(fileName);
  if (FOOTPRINT_PAIR_EXTENSIONS.includes(extension)) {
    baseName = baseName.replace(/\./g, '').toLowerCase();
  }

  return `${baseName}${extension}`;
};

/** True when the name violates the footprint "+" rule (reject, never strip). */
export const hasIllegalFootprintPlus = (fileName) => (
  isFootprintPairFile(fileName) && String(fileName || '').includes('+')
);

const sortFootprintPrimaryFiles = (left, right, getName) => {
  const leftName = getName(left);
  const rightName = getName(right);
  const leftPriority = FOOTPRINT_PRIMARY_EXTENSIONS.indexOf(getCadFileExtension(leftName));
  const rightPriority = FOOTPRINT_PRIMARY_EXTENSIONS.indexOf(getCadFileExtension(rightName));

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return leftName.localeCompare(rightName, undefined, { sensitivity: 'base' });
};

export const groupFootprintFiles = (files, getName = (file) => String(file?.name ?? file?.file_name ?? file?.filename ?? '')) => {
  const groupedFiles = new Map();
  const orderedGroups = [];
  const singles = [];

  for (const file of files || []) {
    const fileName = getName(file);
    if (!isFootprintPairFile(fileName)) {
      singles.push({ type: 'single', file });
      continue;
    }

    const groupKey = normalizeFootprintGroupBase(fileName);
    if (!groupedFiles.has(groupKey)) {
      groupedFiles.set(groupKey, []);
      orderedGroups.push(groupKey);
    }
    groupedFiles.get(groupKey).push(file);
  }

  const groups = [];
  for (const groupKey of orderedGroups) {
    const groupFiles = groupedFiles.get(groupKey) || [];
    const primaryFiles = groupFiles
      .filter((file) => isFootprintPrimaryExtension(getName(file)))
      .sort((left, right) => sortFootprintPrimaryFiles(left, right, getName));
    const draFiles = groupFiles.filter((file) => isFootprintSecondaryFile(getName(file)));
    const otherFiles = groupFiles.filter((file) => !isFootprintPrimaryExtension(getName(file)) && !isFootprintSecondaryFile(getName(file)));
    const usedDra = new Set();

    for (const primary of primaryFiles) {
      const matchingDra = draFiles.find((file) => !usedDra.has(getName(file)));
      if (matchingDra) {
        usedDra.add(getName(matchingDra));
        groups.push({
          type: 'pair',
          primary,
          dra: matchingDra,
          files: [primary, matchingDra],
          pairLabel: `${getCadFileExtension(getName(primary))}/${FOOTPRINT_SECONDARY_EXTENSION}`,
        });
      } else {
        groups.push({ type: 'single', file: primary });
      }
    }

    for (const dra of draFiles) {
      if (!usedDra.has(getName(dra))) {
        groups.push({ type: 'single', file: dra });
      }
    }

    for (const file of otherFiles) {
      groups.push({ type: 'single', file });
    }
  }

  return [...groups, ...singles];
};