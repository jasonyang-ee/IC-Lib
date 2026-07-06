import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import { createAuthLimiter, createGlobalLimiter } from '../middleware/rateLimit.js';

// §V32: per-IP limiter on credential endpoints returns 429 once the window is
// exceeded. Driven over a real listener (no supertest in this repo) so the
// limiter's res/header/status behavior is exercised end-to-end, not mocked.

const post = url => fetch(url, { method: 'POST' });
const get = url => fetch(url);

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

  it('returns 429 after the N+1th failed login attempt', async () => {
    const app = express();
    app.set('trust proxy', 1);
    // Fail every attempt (401) so skipSuccessfulRequests still counts them.
    app.post('/login', createAuthLimiter({ limit: 2, windowMs: 60_000 }), (_req, res) => {
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
    app.post('/login', createAuthLimiter({ limit: 2, windowMs: 60_000 }), (_req, res) => {
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

  it('global ceiling throttles the public read surface', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use('/api', createGlobalLimiter({ limit: 2, windowMs: 60_000 }));
    app.get('/api/components', (_req, res) => res.json([]));
    const base = listen(app);

    const statuses = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await get(`${base}/api/components`)).status);
    }

    expect(statuses).toEqual([200, 200, 429]);
  });
});
