export const THREE_D_MODEL_LABEL = '3D Model';
export const SCHEMATIC_SYMBOL_LABEL = 'Schematic Symbol';
export const PSPICE_LABEL = 'PSpice';
export const PSPICE_LIBRARY_LABEL = 'PSpice Library';
export const PSPICE_SYMBOL_LABEL = 'PSpice Symbol';

export const MODEL_FILE_EXTENSIONS = Object.freeze([
  '.stp',
  '.step',
  '.stl',
  '.iges',
  '.igs',
  '.wrl',
  '.3ds',
  '.x_t',
]);

export const PSPICE_MODEL_FILE_EXTENSIONS = Object.freeze([
  '.lib',
  '.cir',
  '.sub',
  '.inc',
  '.mod',
]);

export const PSPICE_SYMBOL_FILE_EXTENSIONS = Object.freeze([
  '.olb',
]);

export const PSPICE_FILE_EXTENSIONS = Object.freeze([
  ...PSPICE_MODEL_FILE_EXTENSIONS,
  ...PSPICE_SYMBOL_FILE_EXTENSIONS,
]);

export const CAD_FILE_UPLOAD_EXTENSIONS = Object.freeze([
  '.brd',
  '.kicad_mod',
  '.lbr',
  '.pad',
  '.psm',
  '.fsm',
  '.bxl',
  '.plb',
  '.kicad_sym',
  '.bsm',
  '.SchLib',
  ...MODEL_FILE_EXTENSIONS,
  ...PSPICE_FILE_EXTENSIONS,
  '.zip',
]);

export const CAD_FILE_UPLOAD_ACCEPT = CAD_FILE_UPLOAD_EXTENSIONS.join(',');

export const getCadFileExtension = (fileName) => {
  const normalizedName = String(fileName || '').trim();
  const dotIndex = normalizedName.lastIndexOf('.');
  return dotIndex >= 0 ? normalizedName.substring(dotIndex).toLowerCase() : '';
};

export const isAmbiguousCadUploadFile = (fileName) => {
  return PSPICE_SYMBOL_FILE_EXTENSIONS.includes(getCadFileExtension(fileName));
};

export const getPspiceFileRole = (fileName) => {
  const extension = getCadFileExtension(fileName);
  if (PSPICE_SYMBOL_FILE_EXTENSIONS.includes(extension)) {
    return 'symbol';
  }

  if (PSPICE_MODEL_FILE_EXTENSIONS.includes(extension)) {
    return 'library';
  }

  return null;
};

export const getPspiceFileLabel = (fileName) => {
  const role = getPspiceFileRole(fileName);
  if (role === 'symbol') {
    return PSPICE_SYMBOL_LABEL;
  }

  if (role === 'library') {
    return PSPICE_LIBRARY_LABEL;
  }

  return PSPICE_LABEL;
};

export const buildOlbCategoryAssignments = (files, { hasExistingSymbol = false } = {}) => {
  let symbolAssigned = hasExistingSymbol;

  return (Array.isArray(files) ? files : []).map((file) => {
    const assignedCategory = symbolAssigned ? 'pspice' : 'symbol';
    if (assignedCategory === 'symbol') {
      symbolAssigned = true;
    }

    return {
      ...file,
      assignedCategory,
    };
  });
};