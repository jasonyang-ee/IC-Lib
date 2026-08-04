import { describe, expect, it } from 'vitest';
import { collectCadUploadEntries } from '../utils/cadUploadEntries';

describe('ComponentFiles staged uploads', () => {
  it('keeps the server-canonical filename in the staged entry', () => {
    expect(collectCadUploadEntries([
      {
        type: 'archive',
        extracted: [{
          category: 'footprint',
          filename: 'soic-8_b.psm',
          tempFilename: '123-456-soic-8_b.psm',
        }],
      },
    ])).toEqual([{
      category: 'footprint',
      filename: 'soic-8_b.psm',
      tempFilename: '123-456-soic-8_b.psm',
      type: 'footprint',
    }]);
  });
});
