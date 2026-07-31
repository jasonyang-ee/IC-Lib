import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../controllers/settingsController.js';

// §V59/§V48: the server's code default for BOM columns must stay in step with
// client/src/utils/bomExport.js DEFAULT_BOM_COLUMN_IDS - the two are read by
// the same admin screen, and a drift would silently drop a column for
// installs that have never saved a selection.
const CLIENT_DEFAULT_BOM_COLUMN_IDS = [
  'part_number',
  'manufacturer',
  'manufacturer_pn',
  'description',
  'category',
  'value',
  'quantity',
  'available_quantity',
  'location',
  'approval_status',
  'alternative_class',
  'distributors',
];

describe('BOM default columns', () => {
  it('includes the resolved alternative class', () => {
    expect(DEFAULT_SETTINGS.bomDefaults.columnIds).toContain('alternative_class');
  });

  it('matches the client code default exactly, in order', () => {
    expect(DEFAULT_SETTINGS.bomDefaults.columnIds).toEqual(CLIENT_DEFAULT_BOM_COLUMN_IDS);
  });
});
