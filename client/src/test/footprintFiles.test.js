import { describe, expect, it } from 'vitest';

import { groupFootprintFiles, normalizeFootprintFilenameCase } from '../utils/footprintFiles';

describe('footprintFiles', () => {
  it('groups .bsm and .dra files as one footprint pair', () => {
    const grouped = groupFootprintFiles(
      [
        { file_name: 'QFN50.bsm' },
        { file_name: 'QFN50.dra' },
      ],
      (file) => file.file_name,
    );

    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({
      type: 'pair',
      pairLabel: '.bsm/.dra',
    });
  });

  it('only lowercases .psm filenames when normalizing footprint case', () => {
    expect(normalizeFootprintFilenameCase('SOIC8_L.psm')).toBe('soic8_l.psm');
    expect(normalizeFootprintFilenameCase('SOIC8_L.bsm')).toBe('SOIC8_L.bsm');
  });
});