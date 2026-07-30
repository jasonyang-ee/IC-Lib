import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const readRepoFile = (...segments) => fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');

const envExample = readRepoFile('.env.example');
const compose = readRepoFile('docker-compose.yml');
const readme = readRepoFile('README.md');
const oidcService = readRepoFile('server', 'src', 'services', 'oidcService.js');

const listedOidcVariables = (source) => [...source.matchAll(
  /^\s*#?\s*(?:-\s*)?(OIDC_[A-Z_]+)=/gm,
)].map((match) => match[1]).sort();

const runtimeOidcVariables = [...new Set(
  [...oidcService.matchAll(/process\.env\.(OIDC_[A-Z_]+)/g)].map((match) => match[1]),
)].sort();

describe('OIDC configuration documentation', () => {
  it('env and compose expose the same supported OIDC variables and no authorization-claim variables', () => {
    expect(listedOidcVariables(envExample)).toEqual(runtimeOidcVariables);
    expect(listedOidcVariables(compose)).toEqual(runtimeOidcVariables);

    expect(`${envExample}\n${compose}`).not.toMatch(
      /OIDC_(?:ROLE_CLAIMS|GROUP_CLAIMS|WIDS_CLAIMS|TRUST_UNVERIFIED_EMAIL)\b/,
    );
  });

  it('README states AD authentication only and local authorization', () => {
    expect(readme).toMatch(/Express backend\s*(?:->|→)\s*Microsoft Entra ID via OIDC/i);
    expect(readme).toMatch(/authentication only/i);
    expect(readme).toMatch(/role and active state are managed locally/i);
    expect(readme).toMatch(/role and group claims are ignored/i);
    expect(readme).toMatch(/OIDC_DEFAULT_ROLE/i);
    expect(readme).toMatch(/deactivat/i);
    expect(readme).toMatch(/no SCIM, Microsoft Graph, or automatic deprovisioning sync/i);
    expect(readme).toMatch(/up to 24 hours/i);
  });

  it('README documents generic OIDC without Keycloak dependency', () => {
    expect(readme).toMatch(/generic OIDC provider/i);
    expect(readme).toMatch(/openid profile email/i);
    expect(readme).toMatch(/verified email/i);
    expect(readme).toMatch(/local accounts remain available for break-glass access/i);
    expect(readme).toMatch(/no Keycloak deployment or runtime dependency is required/i);
  });
});
