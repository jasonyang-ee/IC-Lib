import { describe, expect, it, vi } from 'vitest';

const poolMocks = vi.hoisted(() => ({ connect: vi.fn() }));
const backupMocks = vi.hoisted(() => ({
  exportBackupSnapshot: vi.fn(),
  parseBackupFile: vi.fn(),
  restoreBackupSnapshot: vi.fn(),
  BackupValidationError: class BackupValidationError extends Error {},
}));

vi.mock('../config/database.js', () => ({ default: { connect: poolMocks.connect } }));
vi.mock('../services/databaseBackupService.js', () => ({
  EXPORT_TABLES: ['users'],
  BackupValidationError: backupMocks.BackupValidationError,
  exportBackupSnapshot: (...args) => backupMocks.exportBackupSnapshot(...args),
  parseBackupFile: (...args) => backupMocks.parseBackupFile(...args),
  restoreBackupSnapshot: (...args) => backupMocks.restoreBackupSnapshot(...args),
}));

const { exportDatabase, importDatabase } = await import('../controllers/settingsController.js');

const makeResponse = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

describe('database backup controllers', () => {
  it('reports incompatible retained staging as an actionable validation error', async () => {
    backupMocks.parseBackupFile.mockReturnValueOnce({ tables: {} });
    const message = 'Backup conflicts with retained ECO staging: eco_orders owner changed';
    backupMocks.restoreBackupSnapshot.mockRejectedValueOnce(new backupMocks.BackupValidationError(message));
    const res = makeResponse();
    await importDatabase({ file: { buffer: Buffer.from('compressed') } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: message });
  });
  it('sends no gzip when snapshot export fails', async () => {
    backupMocks.exportBackupSnapshot.mockRejectedValueOnce(new Error('snapshot failed'));
    const res = makeResponse();

    await exportDatabase({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).not.toHaveBeenCalled();
    expect(res.set).not.toHaveBeenCalled();
  });

  it('rejects oversized decompression before DB access', async () => {
    backupMocks.parseBackupFile.mockImplementationOnce(() => {
      throw new backupMocks.BackupValidationError('Invalid backup file: could not decompress or parse JSON');
    });
    const res = makeResponse();

    await importDatabase({ file: { buffer: Buffer.from('compressed') } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(poolMocks.connect).not.toHaveBeenCalled();
  });

  it('returns a safe table error and never reports failed restore as success', async () => {
    backupMocks.parseBackupFile.mockReturnValueOnce({ _exportDate: '2026-08-10T00:00:00.000Z', tables: { users: [] } });
    backupMocks.restoreBackupSnapshot.mockRejectedValueOnce(new Error('Backup restore incompatible with table users'));
    const res = makeResponse();

    await importDatabase({ file: { buffer: Buffer.from('compressed') } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({
      error: 'Failed to import database',
      message: 'Backup restore incompatible with table users',
    }));
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
