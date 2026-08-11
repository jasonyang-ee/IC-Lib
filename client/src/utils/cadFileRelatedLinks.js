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
