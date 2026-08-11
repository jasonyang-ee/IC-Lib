import { describe, expect, it, vi } from 'vitest';

const poolMocks = vi.hoisted(() => ({ connect: vi.fn() }));
const backupMocks = vi.hoisted(() => ({
  exportBackupSnapshot: vi.fn(),
  parseBackupFile: vi.fn(),
  BackupValidationError: class BackupValidationError extends Error {},
}));

vi.mock('../config/database.js', () => ({ default: { connect: poolMocks.connect } }));
vi.mock('../services/databaseBackupService.js', () => ({
  EXPORT_TABLES: ['users'],
  BackupValidationError: backupMocks.BackupValidationError,
  exportBackupSnapshot: (...args) => backupMocks.exportBackupSnapshot(...args),
  parseBackupFile: (...args) => backupMocks.parseBackupFile(...args),
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
});
