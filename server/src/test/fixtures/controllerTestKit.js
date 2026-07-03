import { vi } from 'vitest';

/**
 * Shared controller-test fixture (T4): express req/res doubles plus a
 * substring-dispatch query mock so integration-style tests can model a DB
 * conversation without a live PostgreSQL.
 */

export const mockReq = (overrides = {}) => ({
  params: {},
  body: {},
  user: { id: 'user-1', userId: 'user-1', username: 'tester', role: 'admin' },
  ...overrides,
});

export const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  res.redirect = vi.fn().mockReturnValue(res);
  return res;
};

/**
 * Build a query mock that answers by first matching SQL substring.
 * `routes` is an array of [needle, result] pairs checked in order; a result
 * may be a function of (params, sql). Unmatched SQL throws so a test never
 * silently green-lights a query it did not model.
 */
export const sqlDispatch = (routes, { fallback } = {}) => vi.fn(async (sql, params) => {
  if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
  for (const [needle, result] of routes) {
    if (typeof sql === 'string' && sql.includes(needle)) {
      return typeof result === 'function' ? result(params, sql) : result;
    }
  }
  if (fallback) return fallback;
  throw new Error(`Unexpected query: ${sql}`);
});

/** Wrap a dispatch mock as a pg client (pool.connect() result). */
export const asClient = (queryMock) => ({
  query: queryMock,
  release: vi.fn(),
});
