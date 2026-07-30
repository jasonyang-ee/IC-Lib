import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const readSql = (...segments) => {
  const filePath = path.join(repoRoot, ...segments);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
};

const normalizeSql = (sql) => sql.replace(/\s+/g, ' ').trim();

const migrationSql = normalizeSql(readSql(
  'database',
  'migrations',
  '17_oidc_identity_continuity.sql',
));
const initUsersSql = normalizeSql(readSql('database', 'init-users.sql'));

describe('OIDC identity continuity schema', () => {
  it('migration and init-users define both continuity columns', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_tenant_id TEXT;/i,
    );
    expect(migrationSql).toMatch(
      /ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_object_id TEXT;/i,
    );
    expect(initUsersSql).toMatch(/oidc_tenant_id TEXT/i);
    expect(initUsersSql).toMatch(/oidc_object_id TEXT/i);
    expect(initUsersSql).not.toMatch(/\bALTER TABLE\b/i);
    expect(`${migrationSql} ${initUsersSql}`).not.toMatch(/role_source|oidc_role_mappings/i);
  });

  it('continuity identity is unique only when issuer tenant and object are present', () => {
    const continuityIndex = /CREATE UNIQUE INDEX IF NOT EXISTS users_oidc_continuity_identity_unique ON users\s*\(\s*oidc_issuer\s*,\s*oidc_tenant_id\s*,\s*oidc_object_id\s*\) WHERE oidc_issuer IS NOT NULL AND oidc_tenant_id IS NOT NULL AND oidc_object_id IS NOT NULL;/i;

    expect(migrationSql).toMatch(continuityIndex);
    expect(initUsersSql).toMatch(continuityIndex);
  });
});
