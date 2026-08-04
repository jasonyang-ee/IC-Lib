import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReq, mockRes } from './fixtures/controllerTestKit.js';

const mocks = vi.hoisted(() => ({
  entries: [],
  extractEntryTo: vi.fn(),
  fs: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
  packages: { listPackages: vi.fn() },
}));

vi.mock('fs', () => ({ default: mocks.fs }));
vi.mock('multer', () => {
  const multer = vi.fn(() => ({}));
  multer.diskStorage = vi.fn(() => ({}));
  return { default: multer };
});
vi.mock('adm-zip', () => ({
  default: class AdmZip {
    getEntries() {
      return mocks.entries;
    }

    extractEntryTo(...args) {
      return mocks.extractEntryTo(...args);
    }
  },
}));
vi.mock('../services/packageService.js', () => ({ listPackages: mocks.packages.listPackages }));

const { uploadTempFile } = await import('../controllers/fileUploadController.js');

describe('uploadTempFile package canonicalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.entries = [{ isDirectory: false, entryName: 'footprint/8-SOIC_N.PSM' }];
    mocks.packages.listPackages.mockResolvedValue([
      { short_name: 'SOIC', count_policy: 'append', aliases: [{ alias: 'SOIC' }] },
    ]);
  });

  it('reports the canonical ZIP extraction filename used by later finalization', async () => {
    const res = mockRes();

    await uploadTempFile(mockReq({ files: [{ originalname: 'vendor.zip', path: 'vendor.zip' }] }), res);

    const extracted = res.json.mock.calls[0][0].results[0].extracted[0];
    expect(extracted).toMatchObject({ category: 'footprint', filename: 'soic-8_b.psm' });
    expect(extracted.tempFilename).toMatch(/-soic-8_b\.psm$/);
  });
});
