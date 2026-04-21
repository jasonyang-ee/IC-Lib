import { describe, expect, it } from 'vitest';

import { buildEcoCadFileChanges, stripCadExtension } from '../utils/ecoCadUtils';

describe('ecoCadUtils', () => {
  it('builds unlink and link actions from staged ECO CAD changes', () => {
    const changes = buildEcoCadFileChanges({
      currentCadFiles: {
        symbol: [{ name: 'OPA1611AID.olb' }],
        model: [{ name: 'OPA1611AID.step' }],
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
        footprint: [{ name: 'OPA1611AID.psm' }, { name: 'OPA1611AID.dra' }],
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

  it('does not create duplicate link actions for files already linked to the component', () => {
    const changes = buildEcoCadFileChanges({
      currentCadFiles: {
        symbol: [{ name: 'OPA1611AID.olb' }],
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

  it('strips only the filename extension when comparing CAD base names', () => {
    expect(stripCadExtension('OPA1611AID.olb')).toBe('OPA1611AID');
  });
});