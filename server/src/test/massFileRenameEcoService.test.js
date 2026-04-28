import { describe, expect, it } from 'vitest';
import {
  buildMassFileRenameCadRows,
  buildMassFileRenameSummary,
  MASS_FILE_RENAME_LABEL,
  MASS_FILE_RENAME_PIPELINE_TYPE,
  resolveMassFileRenamePipelineTypes,
} from '../services/massFileRenameEcoService.js';

describe('massFileRenameEcoService', () => {
  it('always includes the dedicated shared-rename pipeline tag for shared file rename ECOs', () => {
    expect(resolveMassFileRenamePipelineTypes([])).toEqual([MASS_FILE_RENAME_PIPELINE_TYPE]);
  });

  it('skips new-part lifecycle tagging while still tagging controlled states', () => {
    expect(resolveMassFileRenamePipelineTypes(['new', 'production', 'archived'])).toEqual([
      'shared_file_rename',
      'prod_status_change',
    ]);
  });

  it('keeps the prototype lifecycle tag when controlled shared renames touch prototype parts', () => {
    expect(resolveMassFileRenamePipelineTypes(['new', 'prototype'])).toEqual([
      'shared_file_rename',
      'proto_status_change',
    ]);
  });

  it('builds a compact single-file summary', () => {
    expect(buildMassFileRenameSummary([
      {
        old_file_name: 'resistor.olb',
        new_file_name: 'resistor_rev_a.olb',
      },
    ], 3)).toBe('resistor.olb -> resistor_rev_a.olb (3 parts)');
  });

  it('builds a grouped summary for footprint-pair renames', () => {
    expect(buildMassFileRenameSummary([
      {
        old_file_name: 'r0603.psm',
        new_file_name: 'r0603_rev_a.psm',
      },
      {
        old_file_name: 'r0603.dra',
        new_file_name: 'r0603_rev_a.dra',
      },
    ], 12)).toBe('r0603.psm +1 file -> r0603_rev_a.psm (12 parts)');
  });

  it('converts staged rename files into ECO CAD change rows', () => {
    expect(buildMassFileRenameCadRows({
      files: [{
        cad_file_id: 'cad-1',
        file_type: 'symbol',
        old_file_name: 'logic.olb',
        new_file_name: 'logic_rev_b.olb',
        current_file_name: 'logic.olb',
        current_file_type: 'symbol',
      }],
    })).toEqual([
      {
        action: 'rename',
        cad_file_id: 'cad-1',
        file_type: 'symbol',
        file_name: 'logic.olb',
        new_file_name: 'logic_rev_b.olb',
        existing_file_name: 'logic.olb',
        existing_file_type: 'symbol',
      },
    ]);
  });

  it('keeps a stable label for list/detail fallbacks when no component part number exists', () => {
    expect(MASS_FILE_RENAME_LABEL).toBe('Shared File Rename');
  });
});
