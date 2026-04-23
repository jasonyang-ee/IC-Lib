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

export const normalizeFootprintFilenameCase = (fileName) => {
  const extension = getCadFileExtension(fileName);
  if (!extension) {
    return String(fileName || '');
  }

  const baseName = getCadFileBaseName(fileName);
  if (extension === '.psm') {
    return `${baseName.toLowerCase()}${extension}`;
  }

  return `${baseName}${extension}`;
};

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