import {
  getPspiceFileLabel,
  PSPICE_LABEL,
  SCHEMATIC_SYMBOL_LABEL,
  THREE_D_MODEL_LABEL,
} from '../../utils/cadFileTypes';

// Map file type IDs from cad_files.file_type to display labels
export const fileTypeLabels = {
  footprint: 'PCB Footprint',
  symbol: SCHEMATIC_SYMBOL_LABEL,
  model: THREE_D_MODEL_LABEL,
  pspice: PSPICE_LABEL,
  pad: 'Pad File',
};

export const getCadFileTypeLabel = (fileType, fileName) => {
  if (fileType === 'pspice') {
    return getPspiceFileLabel(fileName);
  }

  return fileTypeLabels[fileType] || fileType;
};

// Map route type IDs to cad_files.file_type values
export const routeTypeToFileType = {
  footprint: 'footprint',
  schematic: 'symbol',
  step: 'model',
  pspice: 'pspice',
  pad: 'pad',
};
