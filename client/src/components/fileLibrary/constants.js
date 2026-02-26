// Map file type IDs from cad_files.file_type to display labels
export const fileTypeLabels = {
  footprint: 'PCB Footprint',
  symbol: 'Schematic',
  model: 'STEP 3D Model',
  pspice: 'PSpice Model',
  pad: 'Pad File',
};

// Map route type IDs to cad_files.file_type values
export const routeTypeToFileType = {
  footprint: 'footprint',
  schematic: 'symbol',
  step: 'model',
  pspice: 'pspice',
  pad: 'pad',
};
