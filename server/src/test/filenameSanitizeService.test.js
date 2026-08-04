import { describe, expect, it } from 'vitest';

import { planFilenameSanitization } from '../services/filenameSanitizeService.js';

const catalog = [
  { short_name: 'SOIC', count_policy: 'append', aliases: [{ alias: 'SOIC' }] },
  { short_name: 'QFN', count_policy: 'append', aliases: [{ alias: 'QFN' }] },
  { short_name: 'SOT-23-3', count_policy: 'embedded', aliases: [{ alias: 'SOT-23-3' }, { alias: 'TO-236-3' }] },
];

const file = (id, file_name, file_type = 'footprint') => ({ id, file_name, file_type });
const plan = (files) => planFilenameSanitization(files, catalog);

describe('planFilenameSanitization', () => {
  it('canonicalizes footprint names from the file name alone', () => {
    expect(plan([
      file(1, 'soic8_l.psm'),
      file(2, '8-soic_n.psm'),
      file(3, 'qfn50p500x500x80-29n.psm'),
      file(4, 'TO-236-3_m.psm'),
    ])).toEqual([
      { cadFileId: 1, fileType: 'footprint', oldName: 'soic8_l.psm', newName: 'soic-8_c.psm', action: 'rename', reason: null },
      { cadFileId: 2, fileType: 'footprint', oldName: '8-soic_n.psm', newName: 'soic-8_b.psm', action: 'rename', reason: null },
      { cadFileId: 3, fileType: 'footprint', oldName: 'qfn50p500x500x80-29n.psm', newName: 'qfn-29_b.psm', action: 'rename', reason: null },
      { cadFileId: 4, fileType: 'footprint', oldName: 'TO-236-3_m.psm', newName: 'sot-23-3_a.psm', action: 'rename', reason: null },
    ]);
  });

  it('renames a footprint pair onto one canonical base', () => {
    expect(plan([file(1, 'soic8_l.psm'), file(2, 'soic8_l.dra')]).map((entry) => entry.newName))
      .toEqual(['soic-8_c.psm', 'soic-8_c.dra']);
  });

  it('lowercases symbol and model extensions even when the package is unknown', () => {
    expect(plan([file(1, 'My.Symbol.OLB', 'symbol')])).toEqual([
      { cadFileId: 1, fileType: 'symbol', oldName: 'My.Symbol.OLB', newName: 'My.Symbol.olb', action: 'rename', reason: null },
    ]);
    expect(plan([file(1, 'FT260Q-T--3DModel-STEP-510211.STEP', 'model')])[0])
      .toMatchObject({ newName: 'FT260Q-T--3DModel-STEP-510211.step', action: 'rename' });
  });

  it('skips a name that carries no package information', () => {
    expect(plan([file(1, 'ft260q-t--3dmodel-step-510211.step', 'model')])).toEqual([
      {
        cadFileId: 1,
        fileType: 'model',
        oldName: 'ft260q-t--3dmodel-step-510211.step',
        newName: 'ft260q-t--3dmodel-step-510211.step',
        action: 'skip',
        reason: 'no-package-info',
      },
    ]);
  });

  it('skips an append package with no derivable pin count', () => {
    expect(plan([file(1, 'soic_a.psm')])[0]).toMatchObject({ action: 'skip', reason: 'no-pin-count' });
  });

  it('skips IPC hidden-pin and reverse-numbering variants', () => {
    expect(plan([file(1, 'qfn50p500x500x80-20_24n.psm')])[0])
      .toMatchObject({ action: 'skip', reason: 'unsupported-variant' });
    expect(plan([file(2, 'qfn50p500x500x80-20rn.psm')])[0])
      .toMatchObject({ action: 'skip', reason: 'unsupported-variant' });
  });

  it('skips a file already carrying its canonical name', () => {
    expect(plan([file(1, 'soic-8_b.psm')])[0]).toMatchObject({ action: 'skip', reason: 'already-canonical' });
  });

  it('skips a rename whose target is another registered file', () => {
    expect(plan([file(1, 'soic8_l.psm'), file(2, 'soic-8_c.psm')])).toEqual([
      { cadFileId: 1, fileType: 'footprint', oldName: 'soic8_l.psm', newName: 'soic8_l.psm', action: 'skip', reason: 'collision' },
      { cadFileId: 2, fileType: 'footprint', oldName: 'soic-8_c.psm', newName: 'soic-8_c.psm', action: 'skip', reason: 'already-canonical' },
    ]);
  });

  it('skips a file that is not a trackable CAD file', () => {
    expect(plan([file(1, 'readme.txt')])[0]).toMatchObject({ action: 'skip', reason: 'not-trackable' });
  });

  it('leaves pad and pspice files out of the plan entirely', () => {
    expect(plan([
      file(1, 'soic8_l.pad', 'pad'),
      file(2, 'soic8_l.olb', 'pspice'),
      file(3, 'soic8_l.psm'),
    ]).map((entry) => entry.cadFileId)).toEqual([3]);
  });
});
