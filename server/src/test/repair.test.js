import { beforeEach, describe, expect, it, vi } from 'vitest';

const poolMock = {
  end: vi.fn(),
  query: vi.fn(),
};

vi.mock('../config/database.js', () => ({
  default: poolMock,
}));

const { generateRandomPassword, runRepairCommand } = await import('../repair.js');

function createStream() {
  const lines = [];

  return {
    lines,
    write: vi.fn((value) => {
      lines.push(value);
    }),
  };
}

describe('repair CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets admin password and prints the generated value', async () => {
    const db = {
      query: vi.fn().mockResolvedValue({ rowCount: 1 }),
    };
    const bcryptLib = {
      hash: vi.fn().mockResolvedValue('hashed-password'),
    };
    const stdout = createStream();
    const stderr = createStream();

    const exitCode = await runRepairCommand(['admin-reset'], {
      bcryptLib,
      db,
      password: 'AB12CD',
      stderr,
      stdout,
    });

    expect(exitCode).toBe(0);
    expect(bcryptLib.hash).toHaveBeenCalledWith('AB12CD', 10);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      ['hashed-password', 'admin'],
    );
    expect(stdout.lines.join('')).toContain('New password: AB12CD');
    expect(stderr.write).not.toHaveBeenCalled();
  });

  it('fails when admin user does not exist', async () => {
    const db = {
      query: vi.fn().mockResolvedValue({ rowCount: 0 }),
    };
    const bcryptLib = {
      hash: vi.fn().mockResolvedValue('hashed-password'),
    };
    const stdout = createStream();
    const stderr = createStream();

    const exitCode = await runRepairCommand(['admin-reset'], {
      bcryptLib,
      db,
      password: 'AB12CD',
      stderr,
      stdout,
    });

    expect(exitCode).toBe(1);
    expect(stdout.write).not.toHaveBeenCalled();
    expect(stderr.lines.join('')).toContain('User "admin" not found');
  });

  it('rejects unknown repair commands', async () => {
    const stderr = createStream();

    const exitCode = await runRepairCommand(['nope'], { stderr });

    expect(exitCode).toBe(1);
    expect(stderr.lines.join('')).toContain('Unknown repair command: nope');
    expect(stderr.lines.join('')).toContain('admin-reset');
  });

  it('generates a six-character password from the safe alphabet', () => {
    const password = generateRandomPassword();

    expect(password).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
});