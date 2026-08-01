// CAD file types tracked in cad_files. These names are also the filesystem
// subdirectory names under library/ (see CAD_TYPE_SUBDIR).
export const CAD_FILE_TYPES = Object.freeze(['footprint', 'symbol', 'model', 'pspice', 'pad']);

// Map a cad_files.file_type to its filesystem subdirectory under library/.
export const CAD_TYPE_SUBDIR = Object.freeze({
  footprint: 'footprint',
  symbol: 'symbol',
  model: 'model',
  pspice: 'pspice',
  pad: 'pad',
});

// Map a cad_files.file_type to its OrCAD/CIS TEXT column on the components table.
export const CAD_FILE_TYPE_TO_COLUMN = Object.freeze({
  footprint: 'pcb_footprint',
  symbol: 'schematic',
  model: 'step_model',
  pspice: 'pspice',
  pad: 'pad_file',
});

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