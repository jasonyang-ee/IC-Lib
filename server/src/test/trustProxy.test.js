import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';

import { createLoginLimiter } from '../middleware/rateLimit.js';
import { parseTrustProxyHops } from '../config/trustProxy.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const readRepoFile = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('trusted proxy contract (SPEC §V32)', () => {
  let server;

  afterEach(() => new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => {
      server = undefined;
      resolve();
    });
  }));

  it('defaults direct Node to zero and rejects ambiguous hop counts', () => {
    expect(parseTrustProxyHops(undefined)).toBe(0);
    expect(parseTrustProxyHops('0')).toBe(0);
    expect(parseTrustProxyHops(2)).toBe(2);

    for (const value of ['', '-1', '+1', '1.5', '1e2', 'not-a-number', '9007199254740992']) {
      expect(() => parseTrustProxyHops(value)).toThrow(/TRUST_PROXY_HOPS/);
    }
  });

  it('keeps Docker, development config, and index wiring on the same contract', () => {
    expect(readRepoFile('Dockerfile')).toMatch(/PORT=3500 \\\r?\n\tTRUST_PROXY_HOPS=1/);
    expect(readRepoFile('.env.example')).toContain('# TRUST_PROXY_HOPS=0');
    expect(readRepoFile('docker-compose.yml')).toContain('- TRUST_PROXY_HOPS=1');
    expect(readRepoFile('server/src/index.js')).toContain("app.set('trust proxy', trustProxyHops);");
  });

  it('uses one direct client budget despite four forged X-Forwarded-For values', async () => {
    const app = express();
    app.set('trust proxy', parseTrustProxyHops(undefined));
    app.post('/login', createLoginLimiter({ limit: 2, windowMs: 60_000 }), (_req, res) => {
      res.status(401).json({ error: 'bad creds' });
    });
    server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    const forged = ['198.51.100.1', '198.51.100.2', '198.51.100.3', '198.51.100.4'];
    const statuses = [];

    for (const address of forged) {
      const response = await fetch(`${base}/login`, {
        method: 'POST',
        headers: { 'X-Forwarded-For': address },
      });
      statuses.push(response.status);
    }

    expect(statuses).toEqual([401, 401, 429, 429]);
  });

  it('with one trusted nginx hop keys on the proxy-appended client address', async () => {
    const app = express();
    app.set('trust proxy', parseTrustProxyHops('1'));
    app.post('/login', createLoginLimiter({ limit: 2, windowMs: 60_000 }), (_req, res) => {
      res.status(401).json({ error: 'bad creds' });
    });
    server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    const xForwardedFor = [
      '198.51.100.1, 203.0.113.10',
      '198.51.100.2, 203.0.113.10',
      '198.51.100.3, 203.0.113.10',
      '198.51.100.4, 203.0.113.11',
    ];
    const statuses = [];

    for (const header of xForwardedFor) {
      const response = await fetch(`${base}/login`, {
        method: 'POST',
        headers: { 'X-Forwarded-For': header },
      });
      statuses.push(response.status);
    }

    expect(statuses).toEqual([401, 401, 429, 401]);
  });
});
