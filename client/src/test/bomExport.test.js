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
});
