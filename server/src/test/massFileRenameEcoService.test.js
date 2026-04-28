import { describe, expect, it } from 'vitest';
import {
  buildMassFileRenameCadRows,
  buildMassFileRenameSummary,
  MASS_FILE_RENAME_LABEL,
  resolveMassFileRenamePipelineTypes,
} from '../services/massFileRenameEcoService.js';

describe('massFileRenameEcoService', () => {
  it('always includes the filename pipeline tag for shared file rename ECOs', () => {
    expect(resolveMassFileRenamePipelineTypes([])).toEqual(['filename']);
  });

  it('adds both lifecycle pipeline tags when affected parts span prototype and production states', () => {
    expect(resolveMassFileRenamePipelineTypes(['new', 'production', 'archived'])).toEqual([
      'filename',
      'proto_status_change',
      'prod_status_change',
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
