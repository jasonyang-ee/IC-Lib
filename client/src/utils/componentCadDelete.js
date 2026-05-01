import { getCadFileBaseName } from './footprintFiles';

const COMPONENT_FOOTPRINT_RELATED_TYPES = new Set(['pad', 'model']);

const getCadFileName = (file) => String(file?.name ?? file?.file_name ?? '');

const buildCadDeleteKey = (category, file) => (
  file?.id ? `id:${file.id}` : `${category}:${getCadFileName(file)}`
);

const findCurrentCadFile = (filesByCategory, relatedFile) => {
  const currentFiles = Array.isArray(filesByCategory?.[relatedFile.file_type])
    ? filesByCategory[relatedFile.file_type]
    : [];

  return currentFiles.find((currentFile) => {
    if (currentFile?.id && relatedFile?.id) {
      return currentFile.id === relatedFile.id;
    }

    return getCadFileName(currentFile) === relatedFile.file_name;
  });
};

export function collectCadDeleteTargets(filesByCategory, category, filename) {
  const targets = new Map();
  const addTarget = (targetCategory, file) => {
    const targetName = getCadFileName(file);
    if (!targetName) {
      return;
    }

    const key = buildCadDeleteKey(targetCategory, file);
    if (!targets.has(key)) {
      targets.set(key, { category: targetCategory, filename: targetName });
    }
  };

  const categoryFiles = Array.isArray(filesByCategory?.[category]) ? filesByCategory[category] : [];
  const selectedFile = categoryFiles.find((file) => getCadFileName(file) === filename);

  if (category !== 'footprint') {
    if (selectedFile) {
      addTarget(category, selectedFile);
    } else if (filename) {
      targets.set(`${category}:${filename}`, { category, filename });
    }
    return [...targets.values()];
  }

  const footprintFiles = Array.isArray(filesByCategory?.footprint) ? filesByCategory.footprint : [];
  const normalizedBaseName = getCadFileBaseName(filename).toLowerCase();
  const groupedFootprintFiles = footprintFiles.filter(
    (file) => getCadFileBaseName(getCadFileName(file)).toLowerCase() === normalizedBaseName,
  );
  const footprintTargets = groupedFootprintFiles.length > 0
    ? groupedFootprintFiles
    : (selectedFile ? [selectedFile] : []);

  footprintTargets.forEach((file) => addTarget('footprint', file));

  for (const footprintFile of footprintTargets) {
    for (const relatedFile of Array.isArray(footprintFile?.related_files) ? footprintFile.related_files : []) {
      if (!COMPONENT_FOOTPRINT_RELATED_TYPES.has(relatedFile?.file_type)) {
        continue;
      }

      const currentFile = findCurrentCadFile(filesByCategory, relatedFile);
      if (currentFile) {
        addTarget(relatedFile.file_type, currentFile);
      }
    }
  }

  if (targets.size === 0 && filename) {
    targets.set(`${category}:${filename}`, { category, filename });
  }

  return [...targets.values()];
}