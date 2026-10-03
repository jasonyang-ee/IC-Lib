import { describe, expect, it, vi } from 'vitest';

import { applyFilenameSanitization, planFilenameSanitization } from '../services/filenameSanitizeService.js';
import { resolveCanonicalCadFilename } from '../utils/footprintFiles.js';

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
      { cadFileId: 1, groupKey: 'footprint:soic8_l', fileType: 'footprint', oldName: 'soic8_l.psm', newName: 'soic-8_c.psm', action: 'rename', reason: null },
      { cadFileId: 2, groupKey: 'footprint:8-soic_n', fileType: 'footprint', oldName: '8-soic_n.psm', newName: 'soic-8_b.psm', action: 'rename', reason: null },
      { cadFileId: 3, groupKey: 'footprint:qfn50p500x500x80-29n', fileType: 'footprint', oldName: 'qfn50p500x500x80-29n.psm', newName: 'qfn-29_b.psm', action: 'rename', reason: null },
      { cadFileId: 4, groupKey: 'footprint:to-236-3_m', fileType: 'footprint', oldName: 'TO-236-3_m.psm', newName: 'sot-23-3_a.psm', action: 'rename', reason: null },
    ]);
  });

  it('renames a footprint pair onto one canonical base', () => {
    expect(plan([file(1, 'soic8_l.psm'), file(2, 'soic8_l.dra')]).map((entry) => entry.newName))
      .toEqual(['soic-8_c.psm', 'soic-8_c.dra']);
  });

  it('lowercases symbol and model extensions even when the package is unknown', () => {
    expect(plan([file(1, 'My.Symbol.OLB', 'symbol')])).toEqual([
      { cadFileId: 1, groupKey: 'symbol:1', fileType: 'symbol', oldName: 'My.Symbol.OLB', newName: 'My.Symbol.olb', action: 'rename', reason: null },
    ]);
    expect(plan([file(1, 'FT260Q-T--3DModel-STEP-510211.STEP', 'model')])[0])
      .toMatchObject({ newName: 'FT260Q-T--3DModel-STEP-510211.step', action: 'rename' });
  });

  it('skips a name that carries no package information', () => {
    expect(plan([file(1, 'ft260q-t--3dmodel-step-510211.step', 'model')])).toEqual([
      {
        cadFileId: 1,
        groupKey: 'model:1',
        fileType: 'model',
        oldName: 'ft260q-t--3dmodel-step-510211.step',
        newName: 'ft260q-t--3dmodel-step-510211.step',
        action: 'skip',
        reason: 'no-package-info',
      },
    ]);
  });

  // §V63/§V64: a custom MPN-named footprint carries no package information, so
  // it is lowercased and left alone. parsePackageInput does synthesize a
  // shortName for arbitrary text - this guards the fact that the synthesized
  // value is discarded unless it matches a real catalog row, so no fabricated
  // canonical name is ever written to disk.
  it('lowercases a custom MPN footprint without inventing a canonical name', () => {
    expect(resolveCanonicalCadFilename('MAX17761ATP.psm', 'footprint', catalog))
      .toEqual({ fileName: 'max17761atp.psm', reason: 'no-package-info' });
    expect(resolveCanonicalCadFilename('ESP32-WROOM-32.psm', 'footprint', catalog))
      .toEqual({ fileName: 'esp32-wroom-32.psm', reason: 'no-package-info' });

    // Control: a real catalog package still canonicalizes, so the guard above
    // is not just proving the catalog is empty.
    expect(resolveCanonicalCadFilename('8-SOIC_n.psm', 'footprint', catalog))
      .toEqual({ fileName: 'soic-8_b.psm', reason: null });
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
      { cadFileId: 1, groupKey: 'footprint:soic8_l', fileType: 'footprint', oldName: 'soic8_l.psm', newName: 'soic8_l.psm', action: 'skip', reason: 'collision' },
      { cadFileId: 2, groupKey: 'footprint:soic-8_c', fileType: 'footprint', oldName: 'soic-8_c.psm', newName: 'soic-8_c.psm', action: 'skip', reason: 'already-canonical' },
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

describe('applyFilenameSanitization', () => {
  it('submits each footprint pair as one atomic group', async () => {
    const entries = plan([file(1, 'soic8_l.psm'), file(2, 'soic8_l.dra'), file(3, '8-soic_n.olb', 'symbol')]);
    const renameGroup = vi.fn().mockResolvedValue();
    const results = await applyFilenameSanitization(entries, { renameGroup });
    expect(renameGroup.mock.calls.map(([group]) => group.map(entry => entry.newName))).toEqual([
      ['soic-8_c.psm', 'soic-8_c.dra'], ['SOIC-8_B.olb'],
    ]);
    expect(results.every(entry => entry.action === 'rename')).toBe(true);
  });

  it('reports the whole failed group and continues with unrelated files', async () => {
    const entries = plan([file(1, 'soic8_l.psm'), file(2, 'soic8_l.dra'), file(3, 'soic_a.psm'), file(4, '8-soic_n.psm')]);
    const renameGroup = vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue();
    const results = await applyFilenameSanitization(entries, { renameGroup });
    expect(results.map(entry => [entry.cadFileId, entry.action, entry.reason])).toEqual([
      [1, 'skip', 'rename-failed'], [2, 'skip', 'rename-failed'], [3, 'skip', 'no-pin-count'], [4, 'rename', null],
    ]);
    expect(results.slice(0, 2).map(entry => entry.newName)).toEqual(['soic8_l.psm', 'soic8_l.dra']);
    expect(renameGroup).toHaveBeenCalledTimes(2);
  });
});
