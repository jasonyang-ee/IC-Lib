import { describe, expect, it } from 'vitest';

import {
  buildOlbCategoryAssignments,
  CAD_FILE_UPLOAD_ACCEPT,
  getPspiceFileLabel,
  isAmbiguousCadUploadFile,
  MODEL_FILE_EXTENSIONS,
  PSPICE_FILE_EXTENSIONS,
  THREE_D_MODEL_LABEL,
} from '../utils/cadFileTypes';

describe('cadFileTypes', () => {
  it('includes supported 3D model extensions in upload accept filters', () => {
    expect(MODEL_FILE_EXTENSIONS).toEqual(expect.arrayContaining(['.stp', '.step', '.stl', '.iges']));
    expect(CAD_FILE_UPLOAD_ACCEPT.split(',')).toEqual(expect.arrayContaining(['.stp', '.step', '.stl', '.iges']));
  });

  it('uses a generic 3D model label across file-management UI', () => {
    expect(THREE_D_MODEL_LABEL).toBe('3D Model');
  });

  it('includes both PSpice library and symbol extensions in upload filters', () => {
    expect(PSPICE_FILE_EXTENSIONS).toEqual(expect.arrayContaining(['.lib', '.olb', '.cir', '.sub', '.inc', '.mod']));
    expect(CAD_FILE_UPLOAD_ACCEPT.split(',')).toEqual(expect.arrayContaining(['.lib', '.olb', '.cir', '.sub', '.inc', '.mod']));
  });

  it('detects ambiguous .olb uploads and labels PSpice file roles', () => {
    expect(isAmbiguousCadUploadFile('LMV321.olb')).toBe(true);
    expect(isAmbiguousCadUploadFile('LMV321.lib')).toBe(false);
    expect(getPspiceFileLabel('LMV321.olb')).toBe('PSpice Symbol');
    expect(getPspiceFileLabel('LMV321.lib')).toBe('PSpice Library');
  });

  it('defaults the first ambiguous .olb upload to schematic and the next one to PSpice', () => {
    expect(buildOlbCategoryAssignments([
      { tempFilename: 'temp-1', filename: 'first.olb' },
      { tempFilename: 'temp-2', filename: 'second.olb' },
    ])).toEqual([
      { tempFilename: 'temp-1', filename: 'first.olb', assignedCategory: 'symbol' },
      { tempFilename: 'temp-2', filename: 'second.olb', assignedCategory: 'pspice' },
    ]);

    expect(buildOlbCategoryAssignments([
      { tempFilename: 'temp-3', filename: 'third.olb' },
    ], { hasExistingSymbol: true })).toEqual([
      { tempFilename: 'temp-3', filename: 'third.olb', assignedCategory: 'pspice' },
    ]);
  });
});