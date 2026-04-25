import { describe, expect, it } from 'vitest';

import { CAD_FILE_UPLOAD_ACCEPT, MODEL_FILE_EXTENSIONS, THREE_D_MODEL_LABEL } from '../utils/cadFileTypes';

describe('cadFileTypes', () => {
  it('includes supported 3D model extensions in upload accept filters', () => {
    expect(MODEL_FILE_EXTENSIONS).toEqual(expect.arrayContaining(['.stp', '.step', '.stl', '.iges']));
    expect(CAD_FILE_UPLOAD_ACCEPT.split(',')).toEqual(expect.arrayContaining(['.stp', '.step', '.stl', '.iges']));
  });

  it('uses a generic 3D model label across file-management UI', () => {
    expect(THREE_D_MODEL_LABEL).toBe('3D Model');
  });
});