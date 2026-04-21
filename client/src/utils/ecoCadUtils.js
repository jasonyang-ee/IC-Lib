export const CAD_CATEGORY_FIELD_MAP = Object.freeze({
  symbol: 'schematic',
  footprint: 'pcb_footprint',
  pad: 'pad_file',
  model: 'step_model',
  pspice: 'pspice',
});

export const stripCadExtension = (filename) => {
  if (!filename || typeof filename !== 'string') return '';
  const extensionIndex = filename.lastIndexOf('.');
  return extensionIndex > 0 ? filename.substring(0, extensionIndex) : filename;
};

const normalizeCadFileName = (entry) => {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  return typeof entry.name === 'string' ? entry.name : '';
};

export const buildEcoCadFileChanges = ({ currentCadFiles = {}, desiredCadFields = {}, stagedCadFiles = [] } = {}) => {
  const changes = [];

  for (const [category, fieldName] of Object.entries(CAD_CATEGORY_FIELD_MAP)) {
    const desiredBaseNames = new Set(
      (Array.isArray(desiredCadFields[fieldName]) ? desiredCadFields[fieldName] : [])
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );

    const currentFileNames = (Array.isArray(currentCadFiles[category]) ? currentCadFiles[category] : [])
      .map(normalizeCadFileName)
      .filter(Boolean);
    const currentFileSet = new Set(currentFileNames);

    for (const fileName of currentFileNames) {
      if (!desiredBaseNames.has(stripCadExtension(fileName))) {
        changes.push({
          action: 'unlink',
          file_type: category,
          file_name: fileName,
        });
      }
    }

    const stagedFileNames = [...new Set(
      stagedCadFiles
        .filter(file => file?.category === category && file?.filename)
        .map(file => file.filename),
    )];

    for (const fileName of stagedFileNames) {
      if (!desiredBaseNames.has(stripCadExtension(fileName))) continue;
      if (currentFileSet.has(fileName)) continue;

      changes.push({
        action: 'link',
        file_type: category,
        file_name: fileName,
      });
    }
  }

  return changes;
};