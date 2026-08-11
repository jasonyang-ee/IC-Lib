import { describe, expect, it } from 'vitest';
import { getUniqueRelatedAutoFiles } from '../utils/cadFileRelatedLinks';

describe('ComponentFiles Link Existing preview', () => {
  it('previews one unique related file per type for an unsaved part', () => {
    expect(getUniqueRelatedAutoFiles(
      [{ id: 'footprint-1', file_type: 'footprint' }],
      [
        { id: 'pad-1', file_name: 'one.pad', file_type: 'pad', missing: false },
        { id: 'model-1', file_name: 'one.step', file_type: 'model', missing: false },
      ],
      { footprint: [{ name: 'footprint.psm' }] },
    )).toEqual([
      { id: 'pad-1', file_name: 'one.pad', file_type: 'pad', missing: false },
      { id: 'model-1', file_name: 'one.step', file_type: 'model', missing: false },
    ]);
  });

  it('skips ambiguous and already occupied related types', () => {
    expect(getUniqueRelatedAutoFiles(
      [{ id: 'footprint-1', file_type: 'footprint' }],
      [
        { id: 'pad-1', file_name: 'one.pad', file_type: 'pad', missing: false },
        { id: 'pad-2', file_name: 'two.pad', file_type: 'pad', missing: false },
        { id: 'model-1', file_name: 'missing.step', file_type: 'model', missing: true },
        { id: 'model-2', file_name: 'one.step', file_type: 'model', missing: false },
      ],
      { footprint: [{ name: 'footprint.psm' }], model: [{ name: 'existing.step' }] },
    )).toEqual([]);
  });
});
