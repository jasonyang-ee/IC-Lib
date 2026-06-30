import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Models a simple filesystem keyed by basename so the service's real path
// resolution still works while we observe rename/unlink/exists behavior.
const mocks = vi.hoisted(() => ({
  fsState: new Set(),
  fs: {
    existsSync: vi.fn(),
    renameSync: vi.fn(),
    unlinkSync: vi.fn(),
    statSync: vi.fn(),
  },
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

vi.mock('fs', () => ({ default: mocks.fs }));
vi.mock('../config/database.js', () => ({ default: mocks.pool }));

const { renameCadFile, deleteCadFile } = await import('../services/cadFileService.js');

function base(p) {
  return path.basename(String(p));
}

function makeClient({ failOn } = {}) {
  const client = {
    query: vi.fn(async (sql) => {
      if (failOn && typeof sql === 'string' && sql.includes(failOn)) {
        throw new Error('injected DB failure');
      }
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (typeof sql === 'string' && sql.includes('as base_name')) return { rows: [{ base_name: 'old' }] };
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  return client;
}

function configureFs(initialBasenames) {
  mocks.fsState.clear();
  initialBasenames.forEach((name) => mocks.fsState.add(name));

  mocks.fs.existsSync.mockImplementation((p) => mocks.fsState.has(base(p)));
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
  mocks.fs.statSync.mockImplementation((p) => {
    const name = base(p);
    if (!mocks.fsState.has(name)) throw new Error('ENOENT');
    // Distinct, deterministic inode per basename so different files never
    // compare equal (only a true case-only rename would resolve to one inode).
    let ino = 0;
    for (let i = 0; i < name.length; i += 1) ino = (ino * 31 + name.charCodeAt(i)) >>> 0;
    return { dev: 1, ino };
  });
}

function configurePool({ cadFile, affected = [] }) {
  mocks.pool.query.mockImplementation(async (sql) => {
    if (typeof sql === 'string' && sql.includes('SELECT * FROM cad_files WHERE id')) {
      return { rows: cadFile ? [cadFile] : [] };
    }
    if (typeof sql === 'string' && sql.includes('c.part_number')) {
      return { rows: affected };
    }
    return { rows: [] };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('renameCadFile (transactional)', () => {
  it('renames the file and commits on success', async () => {
    configureFs(['old.psm']);
    configurePool({
      cadFile: { id: 'cf-1', file_name: 'old.psm', file_type: 'footprint' },
      affected: [{ id: 'c1' }],
    });
    const client = makeClient();
    mocks.pool.connect.mockResolvedValue(client);

    const result = await renameCadFile('cf-1', 'new.psm');

    expect(result).toEqual({ oldFileName: 'old.psm', newFileName: 'new.psm', fileType: 'footprint' });
    const issued = client.query.mock.calls.map((c) => c[0]);
    expect(issued).toContain('BEGIN');
    expect(issued).toContain('COMMIT');
    expect(issued).not.toContain('ROLLBACK');
    expect(mocks.fs.renameSync).toHaveBeenCalledTimes(1);
    expect(mocks.fsState.has('new.psm')).toBe(true);
    expect(mocks.fsState.has('old.psm')).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back the DB and reverts the physical rename when the cad_files update fails', async () => {
    configureFs(['old.psm']);
    configurePool({
      cadFile: { id: 'cf-1', file_name: 'old.psm', file_type: 'footprint' },
      affected: [{ id: 'c1' }],
    });
    const client = makeClient({ failOn: 'file_name = $1' });
    mocks.pool.connect.mockResolvedValue(client);

    await expect(renameCadFile('cf-1', 'new.psm')).rejects.toThrow('injected DB failure');

    const issued = client.query.mock.calls.map((c) => c[0]);
    expect(issued).toContain('ROLLBACK');
    expect(issued).not.toContain('COMMIT');
    // forward rename + revert rename
    expect(mocks.fs.renameSync).toHaveBeenCalledTimes(2);
    expect(mocks.fsState.has('old.psm')).toBe(true);
    expect(mocks.fsState.has('new.psm')).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rejects a colliding target name without touching the disk', async () => {
    configureFs(['old.psm', 'new.psm']);
    configurePool({
      cadFile: { id: 'cf-1', file_name: 'old.psm', file_type: 'footprint' },
    });

    await expect(renameCadFile('cf-1', 'new.psm')).rejects.toThrow('already exists');
    expect(mocks.fs.renameSync).not.toHaveBeenCalled();
    expect(mocks.pool.connect).not.toHaveBeenCalled();
  });
});

describe('deleteCadFile (transactional, unlink after commit)', () => {
  it('commits the DB delete and then unlinks the file', async () => {
    configureFs(['del.psm']);
    configurePool({
      cadFile: { id: 'cf-9', file_name: 'del.psm', file_type: 'footprint' },
      affected: [],
    });
    const client = makeClient();
    mocks.pool.connect.mockResolvedValue(client);

    const result = await deleteCadFile('cf-9');

    const issued = client.query.mock.calls.map((c) => c[0]);
    expect(issued).toContain('BEGIN');
    expect(issued.some((s) => typeof s === 'string' && s.includes('DELETE FROM cad_files'))).toBe(true);
    expect(issued).toContain('COMMIT');
    expect(mocks.fs.unlinkSync).toHaveBeenCalledTimes(1);
    expect(mocks.fsState.has('del.psm')).toBe(false);
    expect(result.fileName).toBe('del.psm');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and leaves the file on disk when the DB delete fails', async () => {
    configureFs(['del.psm']);
    configurePool({
      cadFile: { id: 'cf-9', file_name: 'del.psm', file_type: 'footprint' },
      affected: [],
    });
    const client = makeClient({ failOn: 'DELETE FROM cad_files' });
    mocks.pool.connect.mockResolvedValue(client);

    await expect(deleteCadFile('cf-9')).rejects.toThrow('injected DB failure');

    const issued = client.query.mock.calls.map((c) => c[0]);
    expect(issued).toContain('ROLLBACK');
    expect(issued).not.toContain('COMMIT');
    expect(mocks.fs.unlinkSync).not.toHaveBeenCalled();
    expect(mocks.fsState.has('del.psm')).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
