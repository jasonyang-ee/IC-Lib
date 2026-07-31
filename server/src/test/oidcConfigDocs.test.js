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
    // §V1: the old "a session stays valid for up to 24 hours" caveat is gone -
    // the README must now describe the per-request cutoff instead.
    expect(readme).toMatch(/ends that user's existing session/i);
    expect(readme).not.toMatch(/up to 24 hours/i);
  });

  it('README documents generic OIDC without Keycloak dependency', () => {
    expect(readme).toMatch(/generic OIDC provider/i);
    expect(readme).toMatch(/openid profile email/i);
    expect(readme).toMatch(/verified email/i);
    expect(readme).toMatch(/local accounts remain available for break-glass access/i);
    expect(readme).toMatch(/no Keycloak deployment or runtime dependency is required/i);
  });
});

describe('SCIM configuration documentation (§V60)', () => {
  const scimService = readRepoFile('server', 'src', 'services', 'scimService.js');
  const runtimeScimVariables = [...new Set(
    [...scimService.matchAll(/'(SCIM_[A-Z_]+)'/g)].map((match) => match[1]),
  )].sort();

  const listedScimVariables = (source) => [...source.matchAll(
    /^\s*#?\s*(?:-\s*)?(SCIM_[A-Z_]+)=/gm,
  )].map((match) => match[1]).sort();

  it('env and compose expose exactly the variables the service reads', () => {
    expect(runtimeScimVariables).toEqual(['SCIM_BEARER_TOKEN', 'SCIM_TENANT_ID']);
    expect(listedScimVariables(envExample)).toEqual(runtimeScimVariables);
    expect(listedScimVariables(compose)).toEqual(runtimeScimVariables);
  });

  it('documents the Entra setup, its limits, and the operator flow', () => {
    expect(readme).toMatch(/https:\/\/iclib\.example\.com\/api\/scim\/v2/);
    expect(readme).toMatch(/Secret Token/);
    expect(readme).toMatch(/at least 32 characters/i);
    expect(readme).toMatch(/leave \*\*Groups\*\* unmapped/i);
    expect(readme).toMatch(/assigned users/i);
    expect(readme).toMatch(/externalId.*objectId/i);
    expect(readme).toMatch(/SCIM never creates or links an account/i);
    expect(readme).toMatch(/403/);
    expect(readme).toMatch(/Roles stay local/i);
    expect(readme).toMatch(/single-tenant/i);
    expect(readme).toMatch(/rotate/i);
  });

  it('carries placeholders only - no usable token in any documented file', () => {
    for (const source of [envExample, compose, readme]) {
      const assignments = [...source.matchAll(/SCIM_BEARER_TOKEN=(\S+)/g)].map(m => m[1]);
      for (const value of assignments) {
        expect(value).toMatch(/^(?:<|generate_)/);
      }
    }
  });
});
