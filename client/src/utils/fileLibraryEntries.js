import { getCadFileBaseName, groupFootprintFiles, normalizeFootprintGroupBase } from './footprintFiles';
import { routeTypeToFileType } from '../components/fileLibrary/constants';

const getComponentCount = (file) => Number(file?.component_count || 0);

export const buildFileEntryKey = (type, fileNames) => {
  const normalizedFileNames = Array.isArray(fileNames) ? fileNames : [fileNames];
  if (type === 'footprint' && normalizedFileNames.length > 1) {
    return `pair:${normalizeFootprintGroupBase(normalizedFileNames[0])}`;
  }

  return `file:${String(normalizedFileNames[0] || '')}`;
};

const buildSingleFileEntry = (file, selectedType) => ({
  key: buildFileEntryKey(selectedType, file.file_name),
  kind: 'single',
  displayName: file.file_name,
  file_type: file.file_type || routeTypeToFileType[selectedType],
  fileNames: [file.file_name],
  files: [file],
  componentCount: getComponentCount(file),
  canDelete: getComponentCount(file) === 0 && !file.pending_eco,
  searchText: file.file_name.toLowerCase(),
});

const buildFootprintEntries = (files) => {
  return groupFootprintFiles(files, (file) => file.file_name)
    .map((item) => {
      if (item.type !== 'pair') {
        return buildSingleFileEntry(item.file, 'footprint');
      }

      const pairFiles = item.files.slice().sort((left, right) => left.file_name.localeCompare(right.file_name, undefined, { sensitivity: 'base' }));
      const groupKey = normalizeFootprintGroupBase(item.primary.file_name);

      return {
        key: `pair:${groupKey}`,
        kind: 'pair',
        displayName: getCadFileBaseName(item.primary.file_name),
        file_type: 'footprint',
        fileNames: pairFiles.map((file) => file.file_name),
        files: pairFiles,
        componentCount: Math.max(...pairFiles.map((file) => getComponentCount(file))),
        canDelete: pairFiles.every((file) => getComponentCount(file) === 0 && !file.pending_eco),
        searchText: `${groupKey} ${pairFiles.map((file) => file.file_name.toLowerCase()).join(' ')}`,
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' }));
};

export const buildFileEntries = (files, selectedType) => {
  if (selectedType === 'footprint') {
    return buildFootprintEntries(files);
  }

  return (files || [])
    .map((file) => buildSingleFileEntry(file, selectedType))
    .sort((left, right) => left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' }));
};
