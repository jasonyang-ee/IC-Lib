import { execFileSync, spawn } from 'child_process';
import { randomUUID } from 'crypto';
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
const checkWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'check.yml');
const testPath = fileURLToPath(import.meta.url);
const migration19Sql = fs.readFileSync(migration19Path, 'utf8');
const migration20Sql = fs.readFileSync(migration20Path, 'utf8');
const initUsersSql = fs.readFileSync(initUsersPath, 'utf8');
const checkWorkflow = fs.readFileSync(checkWorkflowPath, 'utf8');
const testSource = fs.readFileSync(testPath, 'utf8');
const EXTERNAL_DATABASE_URL_ENV = 'OIDC_SCHEMA_TEST_DATABASE_URL';
const POSTGRES_MAJOR_VERSION = 18;

const runTool = (tool, args, { env = {} } = {}) => execFileSync(tool, args, {
  cwd: repoRoot,
  env: {
    ...process.env,
    ...env,
    // PostgreSQL 18's Windows pg_ctl re-exec path requires privileges that
    // are unavailable in the test runner; the cluster is already disposable.
    PG_RESTRICT_EXEC: '1',
  },
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const parsePostgresMajorVersion = (versionOutput) => {
  const match = versionOutput.match(/\b(\d+)\./);
  if (!match) {
    throw new Error(`Unable to read PostgreSQL version from ${versionOutput.trim()}`);
  }
  return Number(match[1]);
};

const parseServerMajorVersion = (versionNumber) => {
  const numericVersion = Number(versionNumber.trim());
  if (!Number.isInteger(numericVersion)) {
    throw new Error(`Unable to read server_version_num from ${versionNumber.trim()}`);
  }
  return Math.floor(numericVersion / 10000);
};

const normalizeDataDirectory = (dataDirectory) => {
  const normalized = path.resolve(dataDirectory).replaceAll('\\', '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
};

const readPostmasterPort = (dataDirectory) => {
  const pidLines = fs.readFileSync(path.join(dataDirectory, 'postmaster.pid'), 'utf8').split(/\r?\n/);
  const port = Number(pidLines[3]);
  if (!Number.isInteger(port)) {
    throw new Error(`Unable to read PostgreSQL port from ${dataDirectory}`);
  }
  return port;
};

const verifyPostgresIdentity = ({ runSql, expectedDataDirectory, expectedPort, serverProcess }) => {
  const serverMajor = parseServerMajorVersion(runSql('SHOW server_version_num;'));
  if (serverMajor !== POSTGRES_MAJOR_VERSION) {
    throw new Error(`PostgreSQL ${POSTGRES_MAJOR_VERSION} required; connected to ${serverMajor}`);
  }

  if (!expectedDataDirectory) {
    return {
      serverMajor,
      verifiedDataDirectory: undefined,
      pidPort: undefined,
      childAlive: undefined,
    };
  }

  const verifiedDataDirectory = normalizeDataDirectory(runSql('SHOW data_directory;').trim());
  if (verifiedDataDirectory !== normalizeDataDirectory(expectedDataDirectory)) {
    throw new Error('Connected PostgreSQL data directory is not owned by this test');
  }

  const pidPort = readPostmasterPort(expectedDataDirectory);
  if (pidPort !== expectedPort) {
    throw new Error('Owned PostgreSQL postmaster.pid does not match requested port');
  }

  if (!serverProcess || serverProcess.exitCode !== null) {
    throw new Error('Owned PostgreSQL child exited before schema verification');
  }

  return {
    serverMajor,
    verifiedDataDirectory,
    pidPort,
    childAlive: true,
  };
};

const requireLocalPostgres18Tools = () => {
  for (const tool of ['initdb', 'postgres', 'pg_ctl']) {
    const majorVersion = parsePostgresMajorVersion(runTool(tool, ['--version']));
    if (majorVersion !== POSTGRES_MAJOR_VERSION) {
      throw new Error(`${tool} must be PostgreSQL ${POSTGRES_MAJOR_VERSION} for local schema tests`);
    }
  }
};

const buildPsqlEnvironment = (connection) => {
  const environment = { ...process.env };
  delete environment.PGHOST;
  delete environment.PGPORT;
  delete environment.PGUSER;
  delete environment.PGDATABASE;
  delete environment.PGPASSWORD;

  if (connection.password !== undefined) {
    environment.PGPASSWORD = connection.password;
  }

  return environment;
};

const createSqlRunner = (connection) => (sql) => runTool('psql', [
  '-X',
  '-q',
  '-t',
  '-A',
  '-v',
  'ON_ERROR_STOP=1',
  '-h',
  connection.host,
  '-p',
  String(connection.port),
  '-U',
  connection.username,
  '-d',
  connection.database,
  '-c',
  sql,
], { env: buildPsqlEnvironment(connection) });

const quoteIdentifier = (identifier) => `"${identifier.replaceAll('"', '""')}"`;

const getExternalConnection = () => {
  const databaseUrl = process.env[EXTERNAL_DATABASE_URL_ENV];
  if (!databaseUrl) {
    return null;
  }

  const parsedUrl = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error(`${EXTERNAL_DATABASE_URL_ENV} must use a PostgreSQL URL`);
  }

  const database = decodeURIComponent(parsedUrl.pathname.slice(1));
  const username = decodeURIComponent(parsedUrl.username);
  if (!parsedUrl.hostname || !database || !username) {
    throw new Error(`${EXTERNAL_DATABASE_URL_ENV} must include host, database, and username`);
  }

  return {
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || 5432),
    username,
    password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
    database,
  };
};

const findFreePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

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
  const runSql = createSqlRunner({
    host: '127.0.0.1',
    port,
    username: 'postgres',
    database: 'postgres',
  });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      runSql('SELECT 1;');
      return { serverProcess, runSql };
    } catch (error) {
      if (serverProcess.exitCode !== null) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  serverProcess.kill();
  throw new Error('scratch PostgreSQL did not become ready');
};

const createExternalEnvironment = (connection) => {
  const schemaName = `oidc_schema_${process.pid}_${randomUUID().replaceAll('-', '')}`;
  const runConnectionSql = createSqlRunner(connection);
  const quotedSchemaName = quoteIdentifier(schemaName);

  return {
    mode: 'external',
    schemaName,
    namespace: `schema:${schemaName}`,
    expectedDataDirectory: undefined,
    expectedPort: undefined,
    serverProcess: undefined,
    verifyIdentity: () => verifyPostgresIdentity({ runSql: runConnectionSql }),
    prepare: () => runConnectionSql(`CREATE SCHEMA ${quotedSchemaName};`),
    runSql: (sql) => runConnectionSql(`SET search_path TO ${quotedSchemaName}; ${sql}`),
    cleanup: () => runConnectionSql(`DROP SCHEMA IF EXISTS ${quotedSchemaName} CASCADE;`),
  };
};

const createLocalEnvironment = async () => {
  requireLocalPostgres18Tools();

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-oidc-ownership-'));
  const port = await findFreePort();
  let serverProcess;
  let runSql;

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
    ({ serverProcess, runSql } = await startScratchServer(dataDir, port));
  } catch (error) {
    if (serverProcess) {
      serverProcess.kill();
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
    throw error;
  }

  return {
    mode: 'local',
    dataDir,
    port,
    namespace: `data-directory:${normalizeDataDirectory(dataDir)}`,
    expectedDataDirectory: normalizeDataDirectory(dataDir),
    expectedPort: port,
    serverProcess,
    verifyIdentity: () => verifyPostgresIdentity({
      runSql,
      expectedDataDirectory: dataDir,
      expectedPort: port,
      serverProcess,
    }),
    prepare: () => {},
    runSql,
    cleanup: () => {
      try {
        runTool('pg_ctl', ['-D', dataDir, '-w', 'stop', '-m', 'fast']);
      } catch {
        serverProcess.kill();
      }
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
};

const createSchemaTestEnvironment = async () => {
  const externalConnection = getExternalConnection();
  return externalConnection
    ? createExternalEnvironment(externalConnection)
    : createLocalEnvironment();
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

  it('uses only the explicit schema-test database URL for external mode', () => {
    expect(testSource).not.toMatch(/process\.env\.(?:DB_[A-Z_]+|DATABASE_URL)/);
    expect(testSource).toContain(EXTERNAL_DATABASE_URL_ENV);
  });

  it('runs the schema regression against the PostgreSQL 18 service', () => {
    expect(checkWorkflow).toMatch(/image:\s*postgres:18/);
    expect(checkWorkflow).toMatch(
      /OIDC_SCHEMA_TEST_DATABASE_URL:\s*postgresql:\/\/postgres:postgres@localhost:5432\/iclib_test/,
    );
  });

  it('rejects PostgreSQL 16 before any schema write', () => {
    const recordedStatements = [];

    expect(() => verifyPostgresIdentity({
      runSql: (sql) => {
        recordedStatements.push(sql);
        return '160000';
      },
    })).toThrow('PostgreSQL 18 required; connected to 16');
    expect(recordedStatements).toEqual(['SHOW server_version_num;']);
  });

  it('aborts before writes when an occupied port serves another PostgreSQL cluster', async () => {
    const decoyEnvironment = await createLocalEnvironment();
    const targetDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-oidc-target-'));

    try {
      runTool('initdb', [
        '-D',
        targetDataDirectory,
        '-U',
        'postgres',
        '--auth=trust',
        '--no-locale',
        '--encoding=UTF8',
      ]);
      const recordedStatements = [];
      const runSql = (sql) => {
        recordedStatements.push(sql);
        return decoyEnvironment.runSql(sql);
      };

      expect(() => verifyPostgresIdentity({
        runSql,
        expectedDataDirectory: targetDataDirectory,
        expectedPort: decoyEnvironment.port,
        serverProcess: decoyEnvironment.serverProcess,
      })).toThrow('Connected PostgreSQL data directory is not owned by this test');
      expect(recordedStatements).toEqual([
        'SHOW server_version_num;',
        'SHOW data_directory;',
      ]);
      expect(recordedStatements.join('\n')).not.toMatch(/\b(?:ALTER|CREATE|DELETE|DROP|INSERT|UPDATE)\b/);
    } finally {
      decoyEnvironment.cleanup();
      fs.rmSync(targetDataDirectory, { recursive: true, force: true });
    }
  });

  it('repairs auth constraints after a same-named decoy constraint', async () => {
    const environment = await createSchemaTestEnvironment();

    try {
      const identity = environment.verifyIdentity();
      expect(identity.serverMajor).toBe(POSTGRES_MAJOR_VERSION);
      expect(identity.verifiedDataDirectory).toBe(environment.expectedDataDirectory);
      expect(identity.pidPort).toBe(environment.expectedPort);
      expect(identity.childAlive).toBe(environment.serverProcess ? true : undefined);
      expect(environment.namespace).toMatch(/^(?:data-directory:|schema:oidc_schema_)/);
      environment.prepare();

      environment.runSql(`
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
      environment.runSql(migration19Sql);
      environment.runSql(migration20Sql);
      environment.runSql(migration20Sql);

      const rows = environment.runSql(
        `SELECT username || ':' || auth_provider || ':' || COALESCE(password_hash, '<NULL>') || ':' || is_active
         FROM users ORDER BY username;`,
      ).trim().split(/\r?\n/);
      expect(rows).toEqual([
        'local-user:local:local-hash:true',
        'null-active-user:local:local-hash:false',
        'oidc-user:oidc:<NULL>:true',
      ]);

      expect(() => environment.runSql(
        "INSERT INTO users (username, password_hash, auth_provider) VALUES ('new-oidc', 'hash', 'oidc');",
      )).toThrow();
      expect(() => environment.runSql(
        "UPDATE users SET password_hash = 'restored' WHERE username = 'oidc-user';",
      )).toThrow();
      expect(() => environment.runSql(
        "INSERT INTO users (username, password_hash, auth_provider, is_active) VALUES ('null-active', 'hash', 'local', NULL);",
      )).toThrow();

      environment.runSql("UPDATE users SET password_hash = 'rotated' WHERE username = 'local-user';");
      environment.runSql("INSERT INTO users (username, password_hash, auth_provider) VALUES ('default-active', 'hash', 'local');");
      const localHash = environment.runSql(
        "SELECT password_hash FROM users WHERE username = 'local-user';",
      ).trim();
      expect(localHash).toBe('rotated');
      expect(environment.runSql(
        "SELECT is_active FROM users WHERE username = 'default-active';",
      ).trim()).toBe('t');
    } finally {
      environment.cleanup();
    }
  });
});
