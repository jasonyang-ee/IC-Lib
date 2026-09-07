import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReq, mockRes } from './fixtures/controllerTestKit.js';

const mocks = vi.hoisted(() => ({
  fsState: new Set(),
  failMoveFrom: null,
  fs: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
  },
  packages: { listPackages: vi.fn() },
}));

vi.mock('fs', () => ({ default: mocks.fs }));
vi.mock('../config/database.js', () => ({ default: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../services/cadFileService.js', () => ({ default: {} }));
vi.mock('../services/packageService.js', () => ({ listPackages: mocks.packages.listPackages }));

const { renameFile, renameStagedFootprintGroup } = await import('../controllers/fileUploadController.js');

const base = (filePath) => path.basename(String(filePath));
const directoryNames = new Set(['footprint', 'symbol', 'model', 'pspice', 'pad', 'temp', 'library']);

function configureFs(initialNames, { failMoveFrom = null } = {}) {
  mocks.fsState.clear();
  initialNames.forEach((name) => mocks.fsState.add(name));
  mocks.failMoveFrom = failMoveFrom;

  mocks.fs.existsSync.mockImplementation((filePath) => {
    const name = base(filePath);
    return directoryNames.has(name) || mocks.fsState.has(name);
  });
  mocks.fs.renameSync.mockImplementation((from, to) => {
    const source = base(from);
    const target = base(to);
    if (source === mocks.failMoveFrom) {
      throw new Error('injected move failure');
    }
    if (!mocks.fsState.has(source)) {
      const error = new Error('ENOENT');
      error.code = 'ENOENT';
      throw error;
    }
    mocks.fsState.delete(source);
    mocks.fsState.add(target);
  });
}

function requestBody(overrides = {}) {
  return {
    files: [
      { tempFilename: '100-200-SI7852ADPT1GE3.PSM', filename: 'si7852adpt1ge3.psm' },
      { tempFilename: '300-400-SI7852ADPT1GE3.DRA', filename: 'si7852adpt1ge3.dra' },
    ],
    newBaseName: 'renamed_footprint',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.packages.listPackages.mockResolvedValue([]);
});

describe('renameStagedFootprintGroup', () => {
  it.each(['../outside.psm', '..\\outside.psm', '/outside.psm', 'C:\\outside.psm'])(
    'rejects a legacy rename source path %s before filesystem access', async (oldFilename) => {
      const res = mockRes();
      await renameFile(mockReq({ body: {
        category: 'footprint', mfgPartNumber: 'PART', oldFilename, newFilename: 'next.psm',
      } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mocks.fs.existsSync).not.toHaveBeenCalled();
      expect(mocks.fs.renameSync).not.toHaveBeenCalled();
    },
  );

  it('renames an original-case staged footprint pair atomically with distinct prefixes', async () => {
    configureFs(['100-200-SI7852ADPT1GE3.PSM', '300-400-SI7852ADPT1GE3.DRA']);
    const res = mockRes();

    await renameStagedFootprintGroup(mockReq({ body: requestBody() }), res);

    expect(mocks.fsState).toEqual(new Set([
      '100-200-renamed_footprint.psm',
      '300-400-renamed_footprint.dra',
    ]));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      renamedFiles: [
        expect.objectContaining({ oldFilename: 'si7852adpt1ge3.psm', newFilename: 'renamed_footprint.psm' }),
        expect.objectContaining({ oldFilename: 'si7852adpt1ge3.dra', newFilename: 'renamed_footprint.dra' }),
      ],
    }));
  });

  it('rejects an invalid staged pair before moving either file', async () => {
    configureFs(['100-200-SI7852ADPT1GE3.PSM', '300-400-SI7852ADPT1GE3.DRA']);
    const res = mockRes();

    await renameStagedFootprintGroup(mockReq({
      body: requestBody({ files: [
        { tempFilename: '100-200-SI7852ADPT1GE3.PSM', filename: 'other.psm' },
        { tempFilename: '300-400-SI7852ADPT1GE3.DRA', filename: 'si7852adpt1ge3.dra' },
      ] }),
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.fs.renameSync).not.toHaveBeenCalled();
    expect(mocks.fsState).toEqual(new Set(['100-200-SI7852ADPT1GE3.PSM', '300-400-SI7852ADPT1GE3.DRA']));
  });

  it('restores the first temp file when the second move fails', async () => {
    configureFs(
      ['100-200-SI7852ADPT1GE3.PSM', '300-400-SI7852ADPT1GE3.DRA'],
      { failMoveFrom: '300-400-SI7852ADPT1GE3.DRA' },
    );
    const res = mockRes();

    await renameStagedFootprintGroup(mockReq({ body: requestBody() }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(mocks.fsState).toEqual(new Set(['100-200-SI7852ADPT1GE3.PSM', '300-400-SI7852ADPT1GE3.DRA']));
    expect(mocks.fs.renameSync).toHaveBeenCalledTimes(3);
  });
});
