import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReq, mockRes } from './fixtures/controllerTestKit.js';

const mocks = vi.hoisted(() => ({
  entries: [],
  fs: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    openSync: vi.fn(() => 1),
    writeFileSync: vi.fn(),
    closeSync: vi.fn(),
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

    getEntryCount() {
      return mocks.entries.length;
    }
  },
}));
vi.mock('../services/packageService.js', () => ({ listPackages: mocks.packages.listPackages }));

const { uploadTempFile } = await import('../controllers/fileUploadController.js');

describe('uploadTempFile package canonicalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.entries = [{
      isDirectory: false, entryName: 'footprint/8-SOIC_N.PSM',
      header: { size: 0, compressedSize: 0, method: 0, flags: 0, crc: 0 },
      getCompressedData: () => Buffer.alloc(0),
    }];
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
