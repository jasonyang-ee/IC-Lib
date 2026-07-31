import { describe, expect, it } from 'vitest';
import {
  buildBomExportData,
  DEFAULT_BOM_COLUMN_IDS,
  sanitizeBomColumnIds,
} from '../utils/bomExport';

describe('bomExport', () => {
  it('falls back to the default BOM columns when the saved selection is invalid', () => {
    expect(sanitizeBomColumnIds(['missing-column'])).toEqual([...DEFAULT_BOM_COLUMN_IDS]);
    expect(sanitizeBomColumnIds(null)).toEqual([...DEFAULT_BOM_COLUMN_IDS]);
  });

  it('expands distributor columns and appends sequential alternative columns last', () => {
    const { headers, rows } = buildBomExportData({
      project: { name: 'Power Board', status: 'active', description: 'Demo' },
      selectedColumnIds: ['part_number', 'quantity', 'distributors'],
      components: [
        {
          part_number: 'IC-00001',
          quantity: 2,
          distributors: [
            { distributor_name: 'DigiKey', sku: '296-24958-5-ND' },
          ],
          alternatives: [
            { manufacturer_name: 'TI', manufacturer_pn: 'OPA1611AID' },
          ],
        },
        {
          part_number: 'IC-00002',
          quantity: 4,
          distributors: [
            { distributor_name: 'Mouser', sku: '595-OPA1611AID' },
          ],
          alternatives: [
            { manufacturer_name: 'ADI', manufacturer_pn: 'AD8606ARZ' },
            { manufacturer_name: 'TI', manufacturer_pn: 'LMV358IDR' },
          ],
        },
      ],
    });

    expect(headers).toEqual([
      'Part Number',
      'Quantity',
      'Distributor-DigiKey',
      'Distributor-Mouser',
      'Alternative1 Manufacturer',
      'Alternative1 Manufacturer P/N',
      'Alternative2 Manufacturer',
      'Alternative2 Manufacturer P/N',
    ]);

    expect(rows[0]).toEqual([
      'IC-00001',
      2,
      '296-24958-5-ND',
      '',
      'TI',
      'OPA1611AID',
      '',
      '',
    ]);

    expect(rows[1]).toEqual([
      'IC-00002',
      4,
      '',
      '595-OPA1611AID',
      'ADI',
      'AD8606ARZ',
      'TI',
      'LMV358IDR',
    ]);
  });

  // §V59/§Q3d: the resolved class ships in the code default so a BOM says
  // what may be substituted; an admin who saved a selection keeps theirs.
  describe('alternative class column', () => {
    it('is selected in the code default', () => {
      expect(DEFAULT_BOM_COLUMN_IDS).toContain('alternative_class');
    });

    it('exports the resolved class, and Unrated when nothing is rated', () => {
      const { headers, rows } = buildBomExportData({
        project: { name: 'Power Board', status: 'active' },
        selectedColumnIds: ['part_number', 'alternative_class'],
        components: [
          { part_number: 'IC-00001', alternative_class: 'B' },
          { part_number: 'IC-00002', alternative_class: null },
        ],
      });

      expect(headers).toEqual(['Part Number', 'Alternative Class']);
      expect(rows[0]).toEqual(['IC-00001', 'Class B']);
      expect(rows[1]).toEqual(['IC-00002', 'Unrated']);
    });

    it('keeps an explicitly saved admin selection that omits it', () => {
      expect(sanitizeBomColumnIds(['part_number', 'quantity']))
        .toEqual(['part_number', 'quantity']);
    });
  });
});
