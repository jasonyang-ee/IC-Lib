import { beforeEach, describe, expect, it, vi } from 'vitest';

// §V30: liveness != readiness. These tests lock the split - liveness stays 200
// while the DB is down; readiness returns 503 when the DB is unreachable or the
// schema is not verified.

const queryMock = vi.fn();
const getAuthenticationStatusMock = vi.fn();

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
  },
}));

vi.mock('../services/initializationService.js', () => ({
  getAuthenticationStatus: (...args) => getAuthenticationStatusMock(...args),
}));

const { liveness, readiness } = await import('../controllers/healthController.js');

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('healthController liveness (§V30)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 without touching the database', () => {
    const res = mockRes();
    liveness({}, res);

    // Never calls res.status(503) - a bare res.json is an implicit 200.
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'alive' }),
    );
    // Liveness must not depend on DB reachability.
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe('healthController readiness (§V30)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 503 when the database is unreachable', async () => {
    queryMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = mockRes();

    await readiness({}, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'not ready', database: 'unreachable' }),
    );
    // A down DB must never reach the schema check.
    expect(getAuthenticationStatusMock).not.toHaveBeenCalled();
  });

  it('returns 503 when the DB answers but the schema is not verified', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    getAuthenticationStatusMock.mockResolvedValueOnce({
      usersTableExists: false,
      schemaValid: false,
      defaultAdminExists: false,
      ready: false,
    });
    const res = mockRes();

    await readiness({}, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'not ready', database: 'up' }),
    );
  });

  it('returns 200 when the DB is reachable and the schema is verified', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    getAuthenticationStatusMock.mockResolvedValueOnce({
      usersTableExists: true,
      schemaValid: true,
      defaultAdminExists: true,
      ready: true,
    });
    const res = mockRes();

    await readiness({}, res);

    expect(res.status).not.toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready', database: 'up' }),
    );
  });
});
