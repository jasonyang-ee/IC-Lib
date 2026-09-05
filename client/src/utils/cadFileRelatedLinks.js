export function getUniqueRelatedAutoFiles(selectedFiles, autoFiles, currentFiles) {
  const occupiedTypes = new Set([
    ...selectedFiles.map((file) => file?.file_type),
    ...Object.entries(currentFiles || {})
      .filter(([, files]) => Array.isArray(files) && files.length > 0)
      .map(([fileType]) => fileType),
  ]);
  const candidatesByType = new Map();

  for (const file of autoFiles) {
    if (!file?.id || file.missing || !['pad', 'model'].includes(file.file_type) || occupiedTypes.has(file.file_type)) {
      continue;
    }
    if (!candidatesByType.has(file.file_type)) {
      candidatesByType.set(file.file_type, new Map());
    }
    candidatesByType.get(file.file_type).set(file.id, file);
  }

  return [...candidatesByType.values()]
    .filter((candidates) => candidates.size === 1)
    .flatMap((candidates) => [...candidates.values()]);
}

export function getSelectedRelatedCadFiles(selectedFiles, autoFiles, selectedRelatedFiles, currentFiles) {
  const mergedRelatedFiles = new Map();

  [...getUniqueRelatedAutoFiles(selectedFiles, autoFiles, currentFiles), ...(Array.isArray(selectedRelatedFiles) ? selectedRelatedFiles : [])]
    .forEach((file) => {
      if (!file?.id || file.missing || !['pad', 'model'].includes(file.file_type)) {
        return;
      }

      mergedRelatedFiles.set(file.id, file);
    });

  return [...mergedRelatedFiles.values()];
}

export function collectPersistedCadSelections(localUploads) {
  const persistedSelections = new Map();

  for (const [category, files] of Object.entries(localUploads || {})) {
    for (const file of Array.isArray(files) ? files : []) {
      if (!file?.id || file.tempFilename) {
        continue;
      }

      const fileType = file.file_type || category;
      const fileName = file.file_name || file.name;
      if (!fileType || !fileName) {
        continue;
      }

      persistedSelections.set(file.id, {
        id: file.id,
        file_type: fileType,
        file_name: fileName,
      });
    }
  }

  return [...persistedSelections.values()];
}
