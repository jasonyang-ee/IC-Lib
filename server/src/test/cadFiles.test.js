import { describe, expect, it } from 'vitest';

import { MODEL_FILE_EXTENSIONS } from '../constants/cadFiles.js';

describe('cadFiles constants', () => {
  it('includes supported 3D model extensions for upload and scan flows', () => {
    expect(MODEL_FILE_EXTENSIONS).toEqual(expect.arrayContaining(['.stp', '.step', '.stl', '.iges']));
  });
});