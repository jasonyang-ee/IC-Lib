import { describe, expect, it } from 'vitest';

import { buildEcoCadFileChanges, stripCadExtension } from '../utils/ecoCadUtils';

describe('ecoCadUtils', () => {
  it('builds unlink and link actions from staged ECO CAD changes using API file rows', () => {
    const changes = buildEcoCadFileChanges({
      currentCadFiles: {
        symbol: [{ file_name: 'OPA1611AID.olb' }],
        model: [{ file_name: 'OPA1611AID.step' }],
      },
      desiredCadFields: {
        schematic: [],
        step_model: ['8-SOIC'],
      },
      stagedCadFiles: [
        { category: 'model', filename: '8-SOIC.step' },
      ],
    });

    expect(changes).toEqual([
      { action: 'unlink', file_type: 'symbol', file_name: 'OPA1611AID.olb' },
      { action: 'unlink', file_type: 'model', file_name: 'OPA1611AID.step' },
      { action: 'link', file_type: 'model', file_name: '8-SOIC.step' },
    ]);
  });

  it('unlinks both files in a footprint pair when the shared base name is removed', () => {
    const changes = buildEcoCadFileChanges({
      currentCadFiles: {
        footprint: [{ file_name: 'OPA1611AID.psm' }, { file_name: 'OPA1611AID.dra' }],
      },
      desiredCadFields: {
        pcb_footprint: [],
      },
      stagedCadFiles: [],
    });

    expect(changes).toEqual([
      { action: 'unlink', file_type: 'footprint', file_name: 'OPA1611AID.psm' },
      { action: 'unlink', file_type: 'footprint', file_name: 'OPA1611AID.dra' },
    ]);
  });

  it('treats .bsm and .dra as one removable footprint pair', () => {
    const changes = buildEcoCadFileChanges({
      currentCadFiles: {
        footprint: [{ file_name: 'QFN50.bsm' }, { file_name: 'QFN50.dra' }],
      },
      desiredCadFields: {
        pcb_footprint: [],
      },
      stagedCadFiles: [],
    });

    expect(changes).toEqual([
      { action: 'unlink', file_type: 'footprint', file_name: 'QFN50.bsm' },
      { action: 'unlink', file_type: 'footprint', file_name: 'QFN50.dra' },
    ]);
  });

  it('does not create duplicate link actions for files already linked to the component', () => {
    const changes = buildEcoCadFileChanges({
      currentCadFiles: {
        symbol: [{ file_name: 'OPA1611AID.olb' }],
      },
      desiredCadFields: {
        schematic: ['OPA1611AID'],
      },
      stagedCadFiles: [
        { category: 'symbol', filename: 'OPA1611AID.olb' },
      ],
    });

    expect(changes).toEqual([]);
  });

  it('keeps schematic and PSpice .olb ECO changes isolated by category', () => {
    const changes = buildEcoCadFileChanges({
      currentCadFiles: {
        symbol: [{ file_name: 'LMV321.olb' }],
        pspice: [{ file_name: 'LMV321.olb' }],
      },
      desiredCadFields: {
        schematic: ['LMV321'],
        pspice: [],
      },
      stagedCadFiles: [],
    });

    expect(changes).toEqual([
      { action: 'unlink', file_type: 'pspice', file_name: 'LMV321.olb' },
    ]);
  });

  it('links a staged PSpice .olb without disturbing an existing schematic .olb', () => {
    const changes = buildEcoCadFileChanges({
      currentCadFiles: {
        symbol: [{ file_name: 'LMV321.olb' }],
      },
      desiredCadFields: {
        schematic: ['LMV321'],
        pspice: ['LMV321_SIM'],
      },
      stagedCadFiles: [
        { category: 'pspice', filename: 'LMV321_SIM.olb' },
      ],
    });

    expect(changes).toEqual([
      { action: 'link', file_type: 'pspice', file_name: 'LMV321_SIM.olb' },
    ]);
  });

  it('still supports legacy current CAD entries keyed as name', () => {
    const changes = buildEcoCadFileChanges({
      currentCadFiles: {
        pad: [{ name: 'OPA1611AID.pad' }],
      },
      desiredCadFields: {
        pad_file: [],
      },
      stagedCadFiles: [],
    });

    expect(changes).toEqual([
      { action: 'unlink', file_type: 'pad', file_name: 'OPA1611AID.pad' },
    ]);
  });

  it('strips only the filename extension when comparing CAD base names', () => {
    expect(stripCadExtension('OPA1611AID.olb')).toBe('OPA1611AID');
  });
});