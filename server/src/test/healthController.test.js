import { beforeEach, describe, expect, it, vi } from 'vitest';

// §V30: liveness != readiness. These tests lock the split - liveness stays 200
// while the DB is down; readiness returns 503 whenever the live full-schema
// inspection cannot confirm the app can serve, and its public body never
// names an infrastructure, schema, or auth detail.

const inspectDatabaseSchemaMock = vi.fn();
const queryMock = vi.fn();

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
  },
}));

vi.mock('../services/schemaInspectionService.js', () => ({
  inspectDatabaseSchema: (...args) => inspectDatabaseSchemaMock(...args),
}));

const { liveness, readiness } = await import('../controllers/healthController.js');

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const schemaResult = (overrides = {}) => ({
  valid: true,
  missingTables: [],
  missingViews: [],
  missingColumns: [],
  ...overrides,
});

/** The only keys a public readiness body may ever carry. */
const expectGenericBody = (res) => {
  const body = res.json.mock.calls.at(-1)[0];
  expect(Object.keys(body).sort()).toEqual(['status', 'timestamp']);
  expect(JSON.stringify(body)).not.toMatch(/users|components_full|ECONNREFUSED|admin|Error/i);
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
    // Liveness must not depend on DB reachability or schema state.
    expect(queryMock).not.toHaveBeenCalled();
    expect(inspectDatabaseSchemaMock).not.toHaveBeenCalled();
  });
});

describe('healthController readiness (§V30)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 503 when the inspection query is rejected', async () => {
    inspectDatabaseSchemaMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = mockRes();

    await readiness({}, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'not ready' }));
    expectGenericBody(res);
  });

  it('returns 503 when a required table is missing', async () => {
    inspectDatabaseSchemaMock.mockResolvedValueOnce(
      schemaResult({ valid: false, missingTables: ['users'] }),
    );
    const res = mockRes();

    await readiness({}, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expectGenericBody(res);
  });

  it('returns 503 when a required view is missing', async () => {
    inspectDatabaseSchemaMock.mockResolvedValueOnce(
      schemaResult({ valid: false, missingViews: ['components_full'] }),
    );
    const res = mockRes();

    await readiness({}, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expectGenericBody(res);
  });

  it('returns 503 when a required column is missing', async () => {
    inspectDatabaseSchemaMock.mockResolvedValueOnce(
      schemaResult({ valid: false, missingColumns: [{ table: 'users', column: 'oidc_sub' }] }),
    );
    const res = mockRes();

    await readiness({}, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expectGenericBody(res);
  });

  it('returns 200 after exactly one live inspection when the schema is valid', async () => {
    inspectDatabaseSchemaMock.mockResolvedValueOnce(schemaResult());
    const res = mockRes();

    await readiness({}, res);

    expect(res.status).not.toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }));
    // Uncached: one inspection per request, against the current live schema.
    expect(inspectDatabaseSchemaMock).toHaveBeenCalledTimes(1);
    expect(inspectDatabaseSchemaMock).toHaveBeenCalledWith();
    expectGenericBody(res);
  });
});
