import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createChangePasswordLimiter,
  createLoginLimiter,
  createPublicGlobalLimiter,
} from '../middleware/rateLimit.js';

// §V32: three isolated limiter stores/budgets. Driven over a real listener (no
// supertest in this repo) so the limiters' res/header/status behaviour is
// exercised end-to-end, not mocked.

const post = (url, init) => fetch(url, { method: 'POST', ...init });
const get = (url, init) => fetch(url, init);

describe('rate limiting (§V32)', () => {
  let server;

  afterEach(() => new Promise((resolve) => {
    if (server) {
      server.close(resolve);
      server = undefined;
    } else {
      resolve();
    }
  }));

  const listen = (app) => {
    server = app.listen(0);
    const { port } = server.address();
    return `http://127.0.0.1:${port}`;
  };

  /** Stand-in for `authenticate`: the caller names itself via a header. */
  const fakeAuthenticate = (req, _res, next) => {
    req.user = { id: req.headers['x-test-user'] || 'user-1' };
    next();
  };

  it('returns 429 after the N+1th failed login attempt', async () => {
    const app = express();
    app.set('trust proxy', 1);
    // Fail every attempt (401) so skipSuccessfulRequests still counts them.
    app.post('/login', createLoginLimiter({ limit: 2, windowMs: 60_000 }), (_req, res) => {
      res.status(401).json({ error: 'bad creds' });
    });
    const base = listen(app);

    // Sequential: each response finishes before the next request starts, so
    // the failed-attempt counter is up to date.
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await post(`${base}/login`)).status);
    }

    // First `limit` attempts pass through (401); the next is throttled.
    expect(statuses).toEqual([401, 401, 429]);
  });

  it('does not count successful logins against the limit', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.post('/login', createLoginLimiter({ limit: 2, windowMs: 60_000 }), (_req, res) => {
      res.status(200).json({ ok: true });
    });
    const base = listen(app);

    const statuses = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await post(`${base}/login`)).status);
    }

    // skipSuccessfulRequests: every 200 is decremented, so no 429 ever.
    expect(statuses).toEqual([200, 200, 200, 200]);
  });

  it('keys change-password failures per user, so one operator cannot lock out another', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.post(
      '/change-password',
      fakeAuthenticate,
      createChangePasswordLimiter({ limit: 2, windowMs: 60_000 }),
      (_req, res) => res.status(400).json({ error: 'wrong current password' }),
    );
    const base = listen(app);

    const attempt = (user) => post(`${base}/change-password`, { headers: { 'x-test-user': user } })
      .then((res) => res.status);

    // Same client IP throughout - only the authenticated id differs.
    expect([await attempt('user-a'), await attempt('user-a'), await attempt('user-a')])
      .toEqual([400, 400, 429]);
    expect(await attempt('user-b')).toBe(400);
  });

  it('keeps the login and change-password budgets independent', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.post('/login', createLoginLimiter({ limit: 2, windowMs: 60_000 }), (_req, res) => {
      res.status(401).json({ error: 'bad creds' });
    });
    app.post(
      '/change-password',
      fakeAuthenticate,
      createChangePasswordLimiter({ limit: 2, windowMs: 60_000 }),
      (_req, res) => res.status(400).json({ error: 'wrong current password' }),
    );
    const base = listen(app);

    for (let i = 0; i < 3; i++) await post(`${base}/login`);
    expect((await post(`${base}/login`)).status).toBe(429);

    // Exhausting login must not have touched the change-password store.
    expect((await post(`${base}/change-password`)).status).toBe(400);
  });
});

describe('public global ceiling scope (§V10, §V32)', () => {
  let server;

  afterEach(() => new Promise((resolve) => {
    if (server) {
      server.close(resolve);
      server = undefined;
    } else {
      resolve();
    }
  }));

  /**
   * Mount the real limiter over routes at their production paths so the
   * descriptor lookup runs against real `req.originalUrl` values.
   */
  const listenWithLimiter = ({ limit = 2 } = {}) => {
    const app = express();
    app.set('trust proxy', 1);
    app.use('/api', createPublicGlobalLimiter({ limit, windowMs: 60_000 }));
    app.get('/api/components', (_req, res) => res.json([]));
    app.get('/api/components/:id', (_req, res) => res.json({}));
    app.get('/api/auth/oidc/status', (_req, res) => res.json({ enabled: false }));
    app.post('/api/inventory/search/barcode', (_req, res) => res.json({}));
    app.post('/api/auth/login', (_req, res) => res.status(401).json({}));
    app.get('/api/eco', (_req, res) => res.json([]));
    app.get('/api/dashboard/db-info', (_req, res) => res.json({}));

    server = app.listen(0);
    return `http://127.0.0.1:${server.address().port}`;
  };

  const statusesFor = async (times, run) => {
    const statuses = [];
    for (let i = 0; i < times; i++) statuses.push(await run());
    return statuses;
  };

  it('throttles a public catalog GET', async () => {
    const base = listenWithLimiter();
    const statuses = await statusesFor(3, async () => (await get(`${base}/api/components`)).status);
    expect(statuses).toEqual([200, 200, 429]);
  });

  it('shares one public budget across mixed-case GET and implicit HEAD variants', async () => {
    const base = listenWithLimiter({ limit: 1 });
    const head = (url) => fetch(url, { method: 'HEAD' });

    expect((await get(`${base}/API/Components`)).status).toBe(200);
    expect((await head(`${base}/api/components`)).status).toBe(429);
    expect((await get(`${base}/aPi/cOmPoNeNtS`)).status).toBe(429);
  });

  it('throttles the barcode lookup and the public OIDC status GET', async () => {
    const base = listenWithLimiter();
    expect(await statusesFor(3, async () => (await post(`${base}/api/inventory/search/barcode`)).status))
      .toEqual([200, 200, 429]);

    const base2Statuses = await statusesFor(3, async () => (await get(`${base}/api/auth/oidc/status`)).status);
    // Same shared per-IP budget, already exhausted above.
    expect(base2Statuses).toEqual([429, 429, 429]);
  });

  it('leaves private routes unthrottled and stops them spending the public budget', async () => {
    const base = listenWithLimiter();

    // Private traffic first, far past the ceiling: never throttled...
    const privateStatuses = await statusesFor(5, async () => (await get(`${base}/api/eco`)).status);
    expect(privateStatuses).toEqual([200, 200, 200, 200, 200]);
    expect((await get(`${base}/api/dashboard/db-info`)).status).toBe(200);

    // ...and the guest budget is still fully intact afterwards.
    expect(await statusesFor(3, async () => (await get(`${base}/api/components`)).status))
      .toEqual([200, 200, 429]);
  });

  it('excludes POST /api/auth/login, which owns its own credential limiter', async () => {
    const base = listenWithLimiter();
    const statuses = await statusesFor(5, async () => (await post(`${base}/api/auth/login`)).status);
    expect(statuses).toEqual([401, 401, 401, 401, 401]);

    expect(await statusesFor(3, async () => (await get(`${base}/api/components`)).status))
      .toEqual([200, 200, 429]);
  });

  it('matches a :param route without matching a lookalike sibling path', async () => {
    const base = listenWithLimiter();
    expect(await statusesFor(3, async () => (await get(`${base}/api/components/abc-123`)).status))
      .toEqual([200, 200, 429]);
  });
});
