import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReq, mockRes } from './fixtures/controllerTestKit.js';

const mocks = vi.hoisted(() => ({
  listPackages: vi.fn(),
  getCadFilesByType: vi.fn(),
  renameCadFile: vi.fn(),
  fs: { existsSync: vi.fn(() => true) },
}));

vi.mock('fs', () => ({ default: mocks.fs }));
vi.mock('../services/packageService.js', () => ({ listPackages: mocks.listPackages }));
vi.mock('../services/cadFileService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    renameCadFile: mocks.renameCadFile,
    default: { ...actual.default, getCadFilesByType: mocks.getCadFilesByType },
  };
});

const { sanitizeFilenames } = await import('../controllers/fileLibraryController.js');
const { scanAndRegisterFiles } = await import('../services/cadFileService.js');

const filesByType = {
  footprint: [
    { id: 'cf-1', file_name: 'soic8_l.psm', file_type: 'footprint' },
    { id: 'cf-2', file_name: 'readme.txt', file_type: 'footprint' },
  ],
  symbol: [],
  model: [],
};

describe('sanitizeFilenames', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPackages.mockResolvedValue([
      { short_name: 'SOIC', count_policy: 'append', aliases: [{ alias: 'SOIC' }] },
    ]);
    mocks.getCadFilesByType.mockImplementation(async (fileType) => filesByType[fileType] || []);
  });

  it('rejects a run without the typed confirmation and touches nothing', async () => {
    const res = mockRes();

    await sanitizeFilenames(mockReq({ body: { confirmation: 'sanitize' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.getCadFilesByType).not.toHaveBeenCalled();
    expect(mocks.renameCadFile).not.toHaveBeenCalled();
  });

  it('renames in scope and reports every skip with its reason', async () => {
    const res = mockRes();

    await sanitizeFilenames(mockReq({ body: { confirmation: 'SANITIZE' } }), res);

    expect(mocks.getCadFilesByType.mock.calls.map(([type]) => type)).toEqual(['footprint', 'symbol', 'model']);
    expect(mocks.renameCadFile).toHaveBeenCalledWith('cf-1', 'soic-8_c.psm');
    expect(res.json).toHaveBeenCalledWith({
      renamed: 1,
      skipped: 1,
      failed: 0,
      entries: [
        { fileType: 'footprint', oldName: 'soic8_l.psm', newName: 'soic-8_c.psm', action: 'rename', reason: null },
        { fileType: 'footprint', oldName: 'readme.txt', newName: 'readme.txt', action: 'skip', reason: 'not-trackable' },
      ],
    });
  });

  it('counts a failed rename separately and still answers 200', async () => {
    mocks.renameCadFile.mockRejectedValueOnce(new Error('permission denied'));
    const res = mockRes();

    await sanitizeFilenames(mockReq({ body: { confirmation: 'SANITIZE' } }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ renamed: 0, failed: 1 }));
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it('leaves the library scan free of any rename (SPEC V64)', () => {
    expect(String(scanAndRegisterFiles)).not.toContain('rename');
  });
});
