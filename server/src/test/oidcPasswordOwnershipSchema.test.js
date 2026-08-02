import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const migration19Path = path.join(repoRoot, 'database', 'migrations', '19_oidc_password_ownership.sql');
const migration20Path = path.join(repoRoot, 'database', 'migrations', '20_auth_state_constraints.sql');
const initUsersPath = path.join(repoRoot, 'database', 'init-users.sql');
const migration19Sql = fs.readFileSync(migration19Path, 'utf8');
const migration20Sql = fs.readFileSync(migration20Path, 'utf8');
const initUsersSql = fs.readFileSync(initUsersPath, 'utf8');

const runTool = (tool, args) => execFileSync(tool, args, {
  cwd: repoRoot,
  env: {
    ...process.env,
    // PostgreSQL 18's Windows pg_ctl re-exec path requires privileges that
    // are unavailable in the test runner; the cluster is already disposable.
    PG_RESTRICT_EXEC: '1',
  },
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const runSql = (port, sql) => runTool('psql', [
  '-X',
  '-q',
  '-t',
  '-A',
  '-v',
  'ON_ERROR_STOP=1',
  '-h',
  '127.0.0.1',
  '-p',
  String(port),
  '-U',
  'postgres',
  '-d',
  'postgres',
  '-c',
  sql,
]);

const startScratchServer = async (dataDir, port) => {
  const serverProcess = spawn('postgres', ['-D', dataDir, '-p', String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PG_RESTRICT_EXEC: '1',
    },
    stdio: 'ignore',
    windowsHide: true,
  });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      runSql(port, 'SELECT 1;');
      return serverProcess;
    } catch (error) {
      if (serverProcess.exitCode !== null) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  serverProcess.kill();
  throw new Error(`scratch PostgreSQL did not become ready on port ${port}`);
};

const findFreePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

const findScratchPort = async (forbiddenPorts) => {
  let port = await findFreePort();
  while (forbiddenPorts.includes(port)) {
    port = await findFreePort();
  }
  return port;
};

describe('OIDC password ownership schema', () => {
  it('keeps auth migrations, fresh schema, and guarded seed conflicts aligned', () => {
    expect(migration19Sql).toMatch(
      /UPDATE users\s+SET password_hash = NULL\s+WHERE auth_provider = 'oidc' AND password_hash IS NOT NULL;/,
    );
    expect(migration20Sql).toMatch(
      /UPDATE users\s+SET is_active = false\s+WHERE is_active IS NULL;/,
    );
    expect(migration20Sql).toMatch(
      /ALTER TABLE users ALTER COLUMN is_active SET NOT NULL;/,
    );
    expect(migration20Sql).toMatch(
      /CONSTRAINT users_oidc_password_ownership\s+CHECK \(auth_provider <> 'oidc' OR password_hash IS NULL\)/,
    );
    expect(initUsersSql).toMatch(
      /is_active BOOLEAN NOT NULL DEFAULT true/,
    );
    expect(initUsersSql).toMatch(
      /CONSTRAINT users_oidc_password_ownership\s+CHECK \(auth_provider <> 'oidc' OR password_hash IS NULL\)/,
    );
    expect((initUsersSql.match(/WHEN users\.auth_provider = 'local' THEN EXCLUDED\.password_hash/g) || []))
      .toHaveLength(2);
  });

  it('repairs auth constraints after a same-named decoy constraint', async () => {
    const configuredPort = Number(process.env.DB_PORT || 5432);
    const scratchPort = await findScratchPort([configuredPort, 5434]);
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-oidc-ownership-'));
    let serverProcess;

    expect(scratchPort).not.toBe(configuredPort);
    expect(scratchPort).not.toBe(5434);
    expect(`127.0.0.1:${scratchPort}`).not.toBe(
      `${process.env.DB_HOST || 'localhost'}:${configuredPort}`,
    );

    try {
      runTool('initdb', [
        '-D',
        dataDir,
        '-U',
        'postgres',
        '--auth=trust',
        '--no-locale',
        '--encoding=UTF8',
      ]);
      serverProcess = await startScratchServer(dataDir, scratchPort);

      runSql(scratchPort, `
        CREATE TABLE users (
          id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          auth_provider TEXT NOT NULL DEFAULT 'local',
          is_active BOOLEAN DEFAULT true
        );
        CREATE SCHEMA decoy;
        CREATE TABLE decoy.users (
          id INTEGER PRIMARY KEY,
          auth_provider TEXT,
          password_hash TEXT,
          CONSTRAINT users_oidc_password_ownership CHECK (true)
        );
        INSERT INTO users (username, password_hash, auth_provider, is_active)
        VALUES ('oidc-user', 'legacy-oidc-hash', 'oidc', true),
               ('local-user', 'local-hash', 'local', true),
               ('null-active-user', 'local-hash', 'local', NULL);
      `);
      runSql(scratchPort, migration19Sql);
      runSql(scratchPort, migration20Sql);
      runSql(scratchPort, migration20Sql);

      const rows = runSql(
        scratchPort,
        `SELECT username || ':' || auth_provider || ':' || COALESCE(password_hash, '<NULL>') || ':' || is_active
         FROM users ORDER BY username;`,
      ).trim().split(/\r?\n/);
      expect(rows).toEqual([
        'local-user:local:local-hash:true',
        'null-active-user:local:local-hash:false',
        'oidc-user:oidc:<NULL>:true',
      ]);

      expect(() => runSql(
        scratchPort,
        "INSERT INTO users (username, password_hash, auth_provider) VALUES ('new-oidc', 'hash', 'oidc');",
      )).toThrow();
      expect(() => runSql(
        scratchPort,
        "UPDATE users SET password_hash = 'restored' WHERE username = 'oidc-user';",
      )).toThrow();
      expect(() => runSql(
        scratchPort,
        "INSERT INTO users (username, password_hash, auth_provider, is_active) VALUES ('null-active', 'hash', 'local', NULL);",
      )).toThrow();

      runSql(scratchPort, "UPDATE users SET password_hash = 'rotated' WHERE username = 'local-user';");
      runSql(scratchPort, "INSERT INTO users (username, password_hash, auth_provider) VALUES ('default-active', 'hash', 'local');");
      const localHash = runSql(
        scratchPort,
        "SELECT password_hash FROM users WHERE username = 'local-user';",
      ).trim();
      expect(localHash).toBe('rotated');
      expect(runSql(
        scratchPort,
        "SELECT is_active FROM users WHERE username = 'default-active';",
      ).trim()).toBe('t');
    } finally {
      if (serverProcess) {
        try {
          runTool('pg_ctl', ['-D', dataDir, '-w', 'stop', '-m', 'fast']);
        } catch {
          serverProcess.kill();
        }
      }
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
