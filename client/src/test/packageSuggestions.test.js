import { describe, expect, it } from 'vitest';

import { mergePackageSuggestions } from '../utils/libraryUtils';

const catalog = [
  { short_name: 'SOIC' },
  { short_name: 'SOT-23-3' },
];

describe('mergePackageSuggestions', () => {
  it('lists catalog packages for a category that has no components yet', () => {
    expect(mergePackageSuggestions(catalog, [])).toEqual(['SOIC', 'SOT-23-3']);
  });

  it('keeps site-specific stored values after the catalog names', () => {
    expect(mergePackageSuggestions(catalog, ['Custom Module'])).toEqual(['SOIC', 'SOT-23-3', 'Custom Module']);
  });

  it('lists a stored value matching a catalog package exactly once', () => {
    expect(mergePackageSuggestions(catalog, ['sot 23 3', 'SOIC'])).toEqual(['SOIC', 'SOT-23-3']);
  });

  it('tolerates missing responses', () => {
    expect(mergePackageSuggestions(undefined, undefined)).toEqual([]);
    expect(mergePackageSuggestions(catalog, [null, '', '  '])).toEqual(['SOIC', 'SOT-23-3']);
  });
});
