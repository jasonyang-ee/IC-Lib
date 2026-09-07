import { describe, expect, it } from 'vitest';

import { collectCadDeleteTargets } from '../utils/componentCadDelete';

describe('collectCadDeleteTargets', () => {
  it('keeps non-footprint deletes scoped to the selected file', () => {
    expect(collectCadDeleteTargets({ pad: [{ name: 'one.pad' }, { name: 'two.pad' }] }, 'pad', 'two.pad')).toEqual([
      { category: 'pad', filename: 'two.pad' },
    ]);
  });

  it('removes the whole footprint group and currently linked pad/model entries', () => {
    const filesByCategory = {
      footprint: [
        {
          id: 'fp-1',
          name: 'SOIC8_n.psm',
          related_files: [
            { id: 'pad-1', file_name: 'soic8_n.pad', file_type: 'pad' },
            { id: 'model-1', file_name: 'SOIC8.step', file_type: 'model' },
          ],
        },
        {
          id: 'fp-2',
          name: 'SOIC8_n.dra',
          related_files: [
            { id: 'pad-1', file_name: 'soic8_n.pad', file_type: 'pad' },
            { id: 'model-1', file_name: 'SOIC8.step', file_type: 'model' },
          ],
        },
        {
          id: 'fp-3',
          name: 'SOIC8_n.bsm',
          related_files: [
            { id: 'pad-1', file_name: 'soic8_n.pad', file_type: 'pad' },
          ],
        },
      ],
      pad: [
        { id: 'pad-1', name: 'soic8_n.pad' },
        { id: 'pad-2', name: 'other.pad' },
      ],
      model: [
        { id: 'model-1', name: 'SOIC8.step' },
      ],
    };

    expect(collectCadDeleteTargets(filesByCategory, 'footprint', 'SOIC8_n.dra')).toEqual([
      { category: 'footprint', filename: 'SOIC8_n.psm' },
      { category: 'footprint', filename: 'SOIC8_n.dra' },
      { category: 'footprint', filename: 'SOIC8_n.bsm' },
      { category: 'pad', filename: 'soic8_n.pad' },
      { category: 'model', filename: 'SOIC8.step' },
    ]);
  });

  it('retains pads and models needed by remaining density variants', () => {
    const pad = { id: 'shared-pad', file_type: 'pad', file_name: 'shared.pad' };
    const model = { id: 'model', file_type: 'model', file_name: 'body.step' };
    const exclusive = { id: 'a-pad', file_type: 'pad', file_name: 'a.pad' };
    const files = {
      footprint: ['a', 'b', 'c'].flatMap((variant) => ['psm', 'dra'].map((ext) => ({
        id: `${variant}-${ext}`, name: `part_${variant}.${ext}`,
        related_files: variant === 'a' ? [pad, model, exclusive] : [pad, model],
      }))),
      pad: [pad, exclusive, { id: 'unbound', file_name: 'unbound.pad' }],
      model: [model],
    };
    expect(collectCadDeleteTargets(files, 'footprint', 'part_a.psm')).toEqual([
      { category: 'footprint', filename: 'part_a.psm' },
      { category: 'footprint', filename: 'part_a.dra' },
      { category: 'pad', filename: 'a.pad' },
    ]);
  });

  it('does not infer pad removals for multiple variants with no bindings', () => {
    const files = {
      footprint: ['a', 'b', 'c'].map((variant) => ({ name: `part_${variant}.psm` })),
      pad: [{ name: 'part_a.pad' }, { name: 'part_b.pad' }, { name: 'thermal.pad' }],
    };
    expect(collectCadDeleteTargets(files, 'footprint', 'part_a.psm')).toEqual([
      { category: 'footprint', filename: 'part_a.psm' },
    ]);
  });
});
