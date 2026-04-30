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