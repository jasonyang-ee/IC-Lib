import { describe, expect, it } from 'vitest';
import { collectPersistedCadSelections, getSelectedRelatedCadFiles, getUniqueRelatedAutoFiles } from '../utils/cadFileRelatedLinks';

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

  it('keeps explicit ambiguous choices alongside any unique auto-linked files', () => {
    expect(getSelectedRelatedCadFiles(
      [{ id: 'footprint-1', file_type: 'footprint' }],
      [
        { id: 'pad-1', file_name: 'one.pad', file_type: 'pad', missing: false },
        { id: 'pad-2', file_name: 'two.pad', file_type: 'pad', missing: false },
        { id: 'model-1', file_name: 'one.step', file_type: 'model', missing: false },
      ],
      [
        { id: 'pad-2', file_name: 'two.pad', file_type: 'pad', missing: false },
      ],
      { footprint: [{ name: 'footprint.psm' }] },
    )).toEqual([
      { id: 'model-1', file_name: 'one.step', file_type: 'model', missing: false },
      { id: 'pad-2', file_name: 'two.pad', file_type: 'pad', missing: false },
    ]);
  });

  it('collects only persisted existing-file selections for add-mode save', () => {
    expect(collectPersistedCadSelections({
      footprint: [
        { id: 'footprint-1', name: 'SOIC8.psm', file_type: 'footprint' },
        { id: 'footprint-2', name: 'SOIC8.dra', file_type: 'footprint' },
      ],
      model: [
        { id: 'model-1', name: 'SOIC8.step', file_type: 'model' },
        { id: 'model-temp', name: 'temp.step', file_type: 'model', tempFilename: '123-temp.step' },
      ],
      pad: [
        { id: 'pad-1', file_name: 'rx51p5y15d0t.pad', file_type: 'pad' },
      ],
    })).toEqual([
      { id: 'footprint-1', file_name: 'SOIC8.psm', file_type: 'footprint' },
      { id: 'footprint-2', file_name: 'SOIC8.dra', file_type: 'footprint' },
      { id: 'model-1', file_name: 'SOIC8.step', file_type: 'model' },
      { id: 'pad-1', file_name: 'rx51p5y15d0t.pad', file_type: 'pad' },
    ]);
  });
});
