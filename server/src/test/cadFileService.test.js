import { describe, expect, it, vi } from 'vitest';

import {
  autoLinkRelatedCadFilesForComponent,
  regenerateCadText,
  syncFootprintRelatedCadFilesForComponent,
} from '../services/cadFileService.js';

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

  it('auto-links historical pad and 3D model files for a component footprint', async () => {
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [
            { id: 'footprint-1', file_name: 'SOIC8.psm', file_type: 'footprint', file_size: 10, missing: false },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              selected_cad_file_id: 'footprint-1',
              id: 'pad-1',
              file_name: 'rx51p5y15d0t.pad',
              file_type: 'pad',
              file_size: 20,
              missing: false,
            },
            {
              selected_cad_file_id: 'footprint-1',
              id: 'model-1',
              file_name: 'SOIC8.step',
              file_type: 'model',
              file_size: 30,
              missing: false,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    const relatedFiles = await autoLinkRelatedCadFilesForComponent('component-1', db);

    expect(relatedFiles).toEqual([
      {
        id: 'pad-1',
        file_name: 'rx51p5y15d0t.pad',
        file_type: 'pad',
        file_size: 20,
        missing: false,
      },
      {
        id: 'model-1',
        file_name: 'SOIC8.step',
        file_type: 'model',
        file_size: 30,
        missing: false,
      },
    ]);
    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("WHERE ccf.component_id = $1\n      AND cf.file_type IN ('footprint', 'pad', 'model')"),
      ['component-1'],
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('FROM cad_files selected'),
      [['footprint-1']],
    );
    expect(db.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO component_cad_files'),
      ['component-1', 'pad-1'],
    );
    expect(db.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO component_cad_files'),
      ['component-1', 'model-1'],
    );
  });

  it('learns footprint links for current pad and 3D model files', async () => {
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [
            { id: 'footprint-1', file_name: 'SOIC8.psm', file_type: 'footprint', file_size: 10, missing: false },
            { id: 'footprint-2', file_name: 'SOIC8.dra', file_type: 'footprint', file_size: 15, missing: false },
            { id: 'pad-1', file_name: 'rx51p5y15d0t.pad', file_type: 'pad', file_size: 20, missing: false },
            { id: 'model-1', file_name: 'SOIC8.step', file_type: 'model', file_size: 30, missing: false },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { id: 'footprint-1', file_name: 'SOIC8.psm', file_type: 'footprint', file_size: 10, missing: false },
            { id: 'footprint-2', file_name: 'SOIC8.dra', file_type: 'footprint', file_size: 15, missing: false },
            { id: 'pad-1', file_name: 'rx51p5y15d0t.pad', file_type: 'pad', file_size: 20, missing: false },
            { id: 'model-1', file_name: 'SOIC8.step', file_type: 'model', file_size: 30, missing: false },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            { id: 'footprint-1', file_name: 'SOIC8.psm', file_type: 'footprint', file_size: 10, missing: false },
            { id: 'footprint-2', file_name: 'SOIC8.dra', file_type: 'footprint', file_size: 15, missing: false },
            { id: 'model-1', file_name: 'SOIC8.step', file_type: 'model', file_size: 30, missing: false },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    const links = await syncFootprintRelatedCadFilesForComponent('component-1', db);

    expect(links).toEqual([
      { footprint_cad_file_id: 'footprint-1', related_cad_file_id: 'pad-1', related_file_type: 'pad' },
      { footprint_cad_file_id: 'footprint-2', related_cad_file_id: 'pad-1', related_file_type: 'pad' },
      { footprint_cad_file_id: 'footprint-1', related_cad_file_id: 'model-1', related_file_type: 'model' },
      { footprint_cad_file_id: 'footprint-2', related_cad_file_id: 'model-1', related_file_type: 'model' },
    ]);
    expect(db.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO footprint_related_cad_files'),
      ['footprint-1', 'pad-1', 'pad'],
    );
    expect(db.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO footprint_related_cad_files'),
      ['footprint-2', 'pad-1', 'pad'],
    );
    expect(db.query).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining('INSERT INTO footprint_related_cad_files'),
      ['footprint-1', 'model-1', 'model'],
    );
    expect(db.query).toHaveBeenNthCalledWith(
      7,
      expect.stringContaining('INSERT INTO footprint_related_cad_files'),
      ['footprint-2', 'model-1', 'model'],
    );
  });
});