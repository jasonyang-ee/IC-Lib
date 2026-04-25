export const THREE_D_MODEL_LABEL = '3D Model';

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

export const CAD_FILE_UPLOAD_EXTENSIONS = Object.freeze([
  '.brd',
  '.kicad_mod',
  '.lbr',
  '.pad',
  '.olb',
  '.psm',
  '.fsm',
  '.bxl',
  '.plb',
  '.lib',
  '.kicad_sym',
  '.bsm',
  '.SchLib',
  ...MODEL_FILE_EXTENSIONS,
  '.mod',
  '.cir',
  '.sub',
  '.inc',
  '.zip',
]);

export const CAD_FILE_UPLOAD_ACCEPT = CAD_FILE_UPLOAD_EXTENSIONS.join(',');