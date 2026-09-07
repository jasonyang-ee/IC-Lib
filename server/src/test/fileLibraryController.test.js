import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReq, mockRes } from './fixtures/controllerTestKit.js';

const mocks = vi.hoisted(() => ({
  client: { query: vi.fn(), release: vi.fn() },
  pool: { connect: vi.fn() },
  cad: {
    lockDirectCadComponent: vi.fn(),
    linkCadFileToComponent: vi.fn(),
    autoLinkRelatedCadFilesForComponent: vi.fn(),
    regenerateCadText: vi.fn(),
    syncFootprintRelatedCadFilesForComponent: vi.fn(),
  },
}));

vi.mock('../config/database.js', () => ({ default: mocks.pool }));
vi.mock('../services/cadFileService.js', () => ({ default: mocks.cad }));

const { linkFileToComponent } = await import('../controllers/fileLibraryController.js');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pool.connect.mockResolvedValue(mocks.client);
  mocks.client.query.mockImplementation(async (sql) => (
    typeof sql === 'string' && sql.includes('SELECT * FROM cad_files')
      ? { rows: [{ id: 'footprint-1', file_name: 'SOIC8.psm', file_type: 'footprint', missing: false }] }
      : { rows: [] }
  ));
  mocks.cad.linkCadFileToComponent.mockResolvedValue([
    { id: 'footprint-1', file_name: 'SOIC8.psm', file_type: 'footprint' },
  ]);
  mocks.cad.autoLinkRelatedCadFilesForComponent.mockResolvedValue([
    { id: 'pad-1', file_name: 'rx51p5y15d0t.pad', file_type: 'pad' },
    { id: 'model-1', file_name: 'SOIC8.step', file_type: 'model' },
  ]);
  mocks.cad.regenerateCadText.mockResolvedValue();
  mocks.cad.syncFootprintRelatedCadFilesForComponent.mockResolvedValue();
});

describe('linkFileToComponent', () => {
  it('links a footprint and its unique related files in one transaction', async () => {
    const res = mockRes();

    await linkFileToComponent(mockReq({ body: { cadFileId: 'footprint-1', componentId: 'component-1' } }), res);

    expect(mocks.client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mocks.cad.linkCadFileToComponent).toHaveBeenCalledWith(
      'footprint-1', 'component-1', 'footprint', 'SOIC8.psm', mocks.client,
    );
    expect(mocks.cad.autoLinkRelatedCadFilesForComponent).toHaveBeenCalledWith('component-1', mocks.client);
    expect(mocks.cad.regenerateCadText).toHaveBeenCalledWith('component-1', 'pad', mocks.client);
    expect(mocks.cad.regenerateCadText).toHaveBeenCalledWith('component-1', 'model', mocks.client);
    expect(mocks.cad.syncFootprintRelatedCadFilesForComponent).toHaveBeenCalledWith('component-1', mocks.client);
    expect(mocks.client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      linkedCadFiles: expect.arrayContaining([
        expect.objectContaining({ id: 'footprint-1' }),
        expect.objectContaining({ id: 'pad-1' }),
        expect.objectContaining({ id: 'model-1' }),
      ]),
    }));
  });

  it('learns history when a related file is linked directly', async () => {
    mocks.client.query.mockImplementation(async (sql) => (
      typeof sql === 'string' && sql.includes('SELECT * FROM cad_files')
        ? { rows: [{ id: 'pad-1', file_name: 'rx51p5y15d0t.pad', file_type: 'pad', missing: false }] }
        : { rows: [] }
    ));
    mocks.cad.linkCadFileToComponent.mockResolvedValue([
      { id: 'pad-1', file_name: 'rx51p5y15d0t.pad', file_type: 'pad' },
    ]);
    mocks.cad.autoLinkRelatedCadFilesForComponent.mockResolvedValue([]);
    const res = mockRes();

    await linkFileToComponent(mockReq({ body: { cadFileId: 'pad-1', componentId: 'component-1' } }), res);

    expect(mocks.cad.syncFootprintRelatedCadFilesForComponent).toHaveBeenCalledWith('component-1', mocks.client);
    expect(mocks.client.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('rolls back direct linking when related-link regeneration fails', async () => {
    mocks.cad.regenerateCadText.mockRejectedValueOnce(new Error('regen failed'));
    const res = mockRes();

    await linkFileToComponent(mockReq({ body: { cadFileId: 'footprint-1', componentId: 'component-1' } }), res);

    expect(mocks.client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mocks.client.release).toHaveBeenCalledTimes(1);
  });
});
