import { describe, expect, it, vi } from 'vitest';

import { regenerateCadText } from '../services/cadFileService.js';

describe('cadFileService', () => {
  it('regenerates CAD text using the provided database client', async () => {
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ text_value: 'D0008A_L,d0008a_l' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await regenerateCadText('component-1', 'footprint', db);

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FROM component_cad_files ccf'),
      ['component-1', 'footprint'],
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE components SET pcb_footprint = $1'),
      ['D0008A_L,d0008a_l', 'component-1'],
    );
  });
});