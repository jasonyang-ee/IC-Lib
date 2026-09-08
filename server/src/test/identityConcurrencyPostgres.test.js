import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const { poolProxy, compare, hash } = vi.hoisted(() => ({ poolProxy: { connect: vi.fn(), query: vi.fn() }, compare: vi.fn(), hash: vi.fn() }));
vi.mock('bcryptjs', () => ({ default: { compare, hash } }));
vi.mock('../config/database.js', () => ({ default: poolProxy }));
vi.mock('../utils/logger.js', () => ({ logError: vi.fn(), logWarn: vi.fn(), logInfo: vi.fn() }));
vi.mock('../services/activityLogService.js', () => ({ logUserActivity: vi.fn(), logActivity: vi.fn() }));
import { findOrCreateOidcUser } from '../services/oidcService.js';
import { updateUser } from '../controllers/scimController.js';
vi.stubEnv('JWT_SECRET', 'scratch-test-only-signing-key');
const { login, changePassword } = await import('../controllers/authController.js');
const runTool = (tool, args) => execFileSync(tool, args, {
  env: { ...process.env, PG_RESTRICT_EXEC: '1' }, stdio: 'ignore', windowsHide: true,
});
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

const userId = '11111111-1111-1111-1111-111111111111';
const tenantId = '22222222-2222-2222-2222-222222222222';
const objectId = '33333333-3333-3333-3333-333333333333';
const claims = { issuer: 'https://idp.example.com', subject: 'new-sub', email: 'old@example.com', emailVerified: true, tenantId: null, objectId: null };
const response = () => ({ status: vi.fn().mockReturnThis(), type: vi.fn().mockReturnThis(), cookie: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

describe('identity concurrency on scratch PostgreSQL', () => {
  let dataDirectory;
  let database;
  let postgres;
  beforeAll(async () => {
    dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-identity-'));
    const port = await freePort();
    runTool('initdb', ['-D', dataDirectory, '-U', 'postgres', '--auth=trust', '--no-locale', '--encoding=UTF8']);
    postgres = spawn('postgres', ['-D', dataDirectory, '-p', String(port)], {
      env: { ...process.env, PG_RESTRICT_EXEC: '1' }, stdio: 'ignore', windowsHide: true,
    });
    database = new Pool({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        await database.query('SELECT 1');
        break;
      } catch (error) {
        if (attempt === 49 || postgres.exitCode !== null) throw error;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    poolProxy.connect.mockImplementation(() => database.connect());

    await database.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuidv7(), username TEXT UNIQUE, role TEXT DEFAULT 'read-only',
        is_active BOOLEAN DEFAULT true, display_name TEXT, email TEXT, password_hash TEXT, last_login TIMESTAMP,
        auth_provider TEXT DEFAULT 'local', oidc_issuer TEXT, oidc_sub TEXT,
        oidc_tenant_id TEXT, oidc_object_id TEXT
      );
      CREATE UNIQUE INDEX users_oidc_identity_unique ON users (oidc_issuer, oidc_sub) WHERE oidc_issuer IS NOT NULL AND oidc_sub IS NOT NULL;
      CREATE UNIQUE INDEX users_oidc_continuity_identity_unique ON users (oidc_issuer, oidc_tenant_id, oidc_object_id) WHERE oidc_issuer IS NOT NULL AND oidc_tenant_id IS NOT NULL AND oidc_object_id IS NOT NULL;
      CREATE TABLE email_log (recipient_email TEXT, subject TEXT, template_name TEXT, status TEXT, error_message TEXT, eco_id UUID);
    `);
  }, 15000);
  afterAll(async () => {
    await database?.end();
    if (!dataDirectory) return;
    try {
      runTool('pg_ctl', ['-D', dataDirectory, '-w', 'stop', '-m', 'fast']);
    } catch {
      postgres?.kill();
    }
    // Only the directory returned by mkdtemp above belongs to this fixture.
    const resolvedDirectory = path.resolve(dataDirectory);
    if (path.dirname(resolvedDirectory) !== path.resolve(os.tmpdir())
      || !path.basename(resolvedDirectory).startsWith('iclib-identity-')) {
      throw new Error('Refusing to remove a directory outside the scratch fixture');
    }
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }, 15000);


  beforeEach(async () => {
    vi.stubEnv('SCIM_TENANT_ID', tenantId);
    poolProxy.query.mockImplementation((...args) => database.query(...args));
    await database.query('TRUNCATE users, email_log');
    await database.query("INSERT INTO users (id, username, email, password_hash) VALUES ($1, 'local', 'old@example.com', 'original-hash')", [userId]);
  });

  it('does not link an email identity after the local address changes', async () => {
    poolProxy.query.mockImplementation(async (...args) => {
      const result = await database.query(...args);
      if (args[0].includes('SELECT') && args[0].includes('LOWER(email)')) {
        await database.query("UPDATE users SET email = 'new@example.com' WHERE id = $1", [userId]);
      }
      return result;
    });
    await expect(findOrCreateOidcUser(claims)).rejects.toThrow('OIDC identity conflict');
    expect((await database.query('SELECT auth_provider, password_hash, oidc_sub FROM users WHERE id = $1', [userId])).rows[0])
      .toEqual({ auth_provider: 'local', password_hash: 'original-hash', oidc_sub: null });
  });

  it('applies every SCIM attribute against current state after an overlapping update', async () => {
    await database.query("UPDATE users SET auth_provider = 'oidc', oidc_tenant_id = $1, oidc_object_id = $2", [tenantId, objectId]);
    poolProxy.query.mockImplementation(async (...args) => {
      const result = await database.query(...args);
      if (args[0].includes('SELECT') && args[0].includes('oidc_object_id IS NOT NULL')) {
        await database.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);
      }
      return result;
    });
    const res = response();
    await updateUser({ params: { id: userId }, body: { Operations: [{ op: 'replace', value: { active: true, displayName: 'Updated' } }] } }, res);
    expect((await database.query('SELECT is_active, display_name FROM users WHERE id = $1', [userId])).rows[0])
      .toEqual({ is_active: true, display_name: 'Updated' });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ active: true, displayName: 'Updated' }));
  });
  it('rejects local login when federation replaces credentials during password verification', async () => {
    compare.mockImplementationOnce(async () => {
      await database.query("UPDATE users SET auth_provider = 'oidc', password_hash = NULL WHERE id = $1", [userId]);
      return true;
    });
    const res = response();
    await login({ body: { username: 'local', password: 'old-password' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('does not overwrite a competing password reset after validating an old password', async () => {
    compare.mockResolvedValueOnce(true);
    hash.mockImplementationOnce(async () => {
      await database.query("UPDATE users SET password_hash = 'reset-hash' WHERE id = $1", [userId]);
      return 'self-change-hash';
    });
    const res = response();
    await changePassword({ user: { userId }, body: { currentPassword: 'old-password', newPassword: 'new-password' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect((await database.query('SELECT password_hash FROM users WHERE id = $1', [userId])).rows[0].password_hash).toBe('reset-hash');
  });

});
