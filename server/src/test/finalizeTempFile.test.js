import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReq, mockRes } from './fixtures/controllerTestKit.js';

// Basename-keyed filesystem model (template: cadFileServiceTransactions.test.js)
// so the controller's real path handling works while we observe moves/unlinks.
const mocks = vi.hoisted(() => ({
  fsState: new Set(),
  fs: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(),
  },
  pool: { query: vi.fn(), connect: vi.fn() },
  cad: {
    registerCadFile: vi.fn(async (fileName, fileType) => ({ id: 'cf-1', file_name: fileName, file_type: fileType })),
    linkCadFileToComponentByMPN: vi.fn(async () => ({})),
  },
  packages: {
    listPackages: vi.fn(),
  },
}));

vi.mock('fs', () => ({ default: mocks.fs }));
vi.mock('../config/database.js', () => ({ default: mocks.pool }));
vi.mock('../services/cadFileService.js', () => ({ default: mocks.cad }));
vi.mock('../services/packageService.js', () => ({ listPackages: mocks.packages.listPackages }));

const { finalizeTempFile } = await import('../controllers/fileUploadController.js');

const base = (p) => path.basename(String(p));

// Directories always "exist" so ensureDir never mkdirs over them; files exist
// iff their basename is in fsState (temp prefixes keep basenames unique).
const DIR_NAMES = new Set(['footprint', 'symbol', 'model', 'pspice', 'pad', 'temp', 'library']);

const configureFs = (initialBasenames) => {
  mocks.fsState.clear();
  initialBasenames.forEach((name) => mocks.fsState.add(name));

  mocks.fs.existsSync.mockImplementation((p) => {
    const name = base(p);
    return DIR_NAMES.has(name) || mocks.fsState.has(name);
  });
  mocks.fs.renameSync.mockImplementation((from, to) => {
    const f = base(from);
    if (!mocks.fsState.has(f)) {
      const error = new Error('ENOENT');
      error.code = 'ENOENT';
      throw error;
    }
    mocks.fsState.delete(f);
    mocks.fsState.add(base(to));
  });
  mocks.fs.unlinkSync.mockImplementation((p) => { mocks.fsState.delete(base(p)); });
};

describe('finalizeTempFile (T4, V8/V25/V28)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cad.registerCadFile.mockImplementation(async (fileName, fileType) => ({ id: 'cf-1', file_name: fileName, file_type: fileType }));
    mocks.packages.listPackages.mockResolvedValue([
      { short_name: 'SOIC', count_policy: 'append', aliases: [{ alias: 'SOIC' }] },
    ]);
  });

  it('moves the temp file into the category dir under its normalized name and registers + links it', async () => {
    configureFs(['123-456-MyPart.PSM']);

    const req = mockReq({
      body: {
        files: [{ tempFilename: '123-456-MyPart.PSM', category: 'footprint' }],
        mfgPartNumber: 'RC0402FR-0710KL',
      },
    });
    const res = mockRes();

    await finalizeTempFile(req, res);

    // V28: whole name lowercased at the input boundary
    expect(mocks.fsState.has('mypart.psm')).toBe(true);
    expect(mocks.fsState.has('123-456-MyPart.PSM')).toBe(false);
    expect(mocks.cad.registerCadFile).toHaveBeenCalledWith('mypart.psm', 'footprint');
    expect(mocks.cad.linkCadFileToComponentByMPN).toHaveBeenCalledWith('cf-1', 'RC0402FR-0710KL', 'footprint', 'mypart.psm');
    expect(res.json).toHaveBeenCalledWith({
      message: 'Files finalized',
      results: [{ filename: 'mypart.psm', type: 'footprint', collision: false, cadFileId: 'cf-1' }],
    });
  });

  it('moves a staged vendor filename under its catalog-canonical name', async () => {
    configureFs(['123-456-8-SOIC_N.PSM']);

    const req = mockReq({
      body: {
        files: [{ tempFilename: '123-456-8-SOIC_N.PSM', category: 'footprint' }],
        mfgPartNumber: 'RC0402FR-0710KL',
      },
    });
    const res = mockRes();

    await finalizeTempFile(req, res);

    expect(mocks.fsState.has('soic-8_b.psm')).toBe(true);
    expect(mocks.cad.registerCadFile).toHaveBeenCalledWith('soic-8_b.psm', 'footprint');
    expect(res.json.mock.calls[0][0].results).toEqual([
      expect.objectContaining({ filename: 'soic-8_b.psm', collision: false, cadFileId: 'cf-1' }),
    ]);
  });

  it('reports a collision instead of overwriting when the normalized target already exists', async () => {
    configureFs(['123-456-MyPart.PSM', 'mypart.psm']);

    const req = mockReq({
      body: {
        files: [{ tempFilename: '123-456-MyPart.PSM', category: 'footprint' }],
        mfgPartNumber: 'RC0402FR-0710KL',
      },
    });
    const res = mockRes();

    await finalizeTempFile(req, res);

    // V25/V28: no silent overwrite - temp file dropped, existing file linked
    expect(mocks.fs.renameSync).not.toHaveBeenCalled();
    expect(mocks.fsState.has('mypart.psm')).toBe(true);
    expect(mocks.fsState.has('123-456-MyPart.PSM')).toBe(false);
    expect(res.json.mock.calls[0][0].results).toEqual([
      expect.objectContaining({ filename: 'mypart.psm', collision: true, cadFileId: 'cf-1' }),
    ]);
  });

  it('overwrite resolution replaces the existing file', async () => {
    configureFs(['123-456-MyPart.PSM', 'mypart.psm']);

    const req = mockReq({
      body: {
        files: [{ tempFilename: '123-456-MyPart.PSM', category: 'footprint', resolution: 'overwrite' }],
        mfgPartNumber: 'RC0402FR-0710KL',
      },
    });
    const res = mockRes();

    await finalizeTempFile(req, res);

    expect(mocks.fs.unlinkSync).toHaveBeenCalledTimes(1); // the old target
    expect(mocks.fs.renameSync).toHaveBeenCalledTimes(1); // temp -> target
    expect(res.json.mock.calls[0][0].results).toEqual([
      expect.objectContaining({ filename: 'mypart.psm', collision: false, cadFileId: 'cf-1' }),
    ]);
  });

  it('use_existing drops the temp file and links the existing library file', async () => {
    configureFs(['123-456-MyPart.PSM', 'mypart.psm']);

    const req = mockReq({
      body: {
        files: [{ tempFilename: '123-456-MyPart.PSM', category: 'footprint', resolution: 'use_existing' }],
        mfgPartNumber: 'RC0402FR-0710KL',
      },
    });
    const res = mockRes();

    await finalizeTempFile(req, res);

    expect(mocks.fs.renameSync).not.toHaveBeenCalled();
    expect(mocks.fsState.has('123-456-MyPart.PSM')).toBe(false);
    expect(mocks.cad.linkCadFileToComponentByMPN).toHaveBeenCalledWith('cf-1', 'RC0402FR-0710KL', 'footprint', 'mypart.psm');
    expect(res.json.mock.calls[0][0].results).toEqual([
      expect.objectContaining({ filename: 'mypart.psm', collision: true, linked: true, cadFileId: 'cf-1' }),
    ]);
  });

  it('rejects a "+" in a footprint name with a clear error and leaves the temp file alone (V28)', async () => {
    configureFs(['123-456-My+Part.psm']);

    const req = mockReq({
      body: {
        files: [{ tempFilename: '123-456-My+Part.psm', category: 'footprint' }],
        mfgPartNumber: 'RC0402FR-0710KL',
      },
    });
    const res = mockRes();

    await finalizeTempFile(req, res);

    expect(mocks.fs.renameSync).not.toHaveBeenCalled();
    expect(mocks.cad.registerCadFile).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].results).toEqual([
      { filename: 'my+part.psm', error: '"+" is not allowed in OrCAD footprint names' },
    ]);
  });

  it('skips a temp file that no longer exists instead of failing the batch', async () => {
    configureFs([]);

    const req = mockReq({
      body: {
        files: [{ tempFilename: '123-456-gone.psm', category: 'footprint' }],
        mfgPartNumber: 'RC0402FR-0710KL',
      },
    });
    const res = mockRes();

    await finalizeTempFile(req, res);

    expect(res.json.mock.calls[0][0].results).toEqual([
      { filename: '123-456-gone.psm', error: 'Temp file not found' },
    ]);
  });

  it('400s when there is nothing to finalize', async () => {
    configureFs([]);
    const res = mockRes();

    await finalizeTempFile(mockReq({ body: {} }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
