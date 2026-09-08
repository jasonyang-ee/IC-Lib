import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
  },
}));

const discoveryMock = vi.fn();
const buildAuthorizationUrlMock = vi.fn();
const authorizationCodeGrantMock = vi.fn();

vi.mock('openid-client', () => ({
  discovery: (...args) => discoveryMock(...args),
  randomPKCECodeVerifier: () => 'test-verifier',
  calculatePKCECodeChallenge: async () => 'test-challenge',
  randomState: () => 'test-state',
  randomNonce: () => 'test-nonce',
  buildAuthorizationUrl: (...args) => buildAuthorizationUrlMock(...args),
  authorizationCodeGrant: (...args) => authorizationCodeGrantMock(...args),
}));

const {
  isOidcEnabled,
  getProviderName,
  getDefaultRole,
  getPostLoginRedirect,
  getOidcConfiguration,
  resetOidcConfigurationCache,
  buildAuthorizationRequest,
  exchangeAuthorizationCode,
  findOrCreateOidcUser,
} = await import('../services/oidcService.js');

const CLAIMS = {
  issuer: 'https://idp.example.com',
  subject: 'sub-123',
  email: 'jane@example.com',
  emailVerified: true,
  preferredUsername: 'jane.doe',
  displayName: 'Jane Doe',
  tenantId: null,
  objectId: null,
};

const CONTINUITY_CLAIMS = {
  ...CLAIMS,
  tenantId: '11111111-2222-3333-4444-555555555555',
  objectId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
};

const ACTIVE_USER = {
  id: 'user-1', username: 'jane.doe', role: 'read-write', is_active: true, display_name: 'Jane Doe',
};

describe('oidcService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOidcConfigurationCache();
    vi.stubEnv('OIDC_ISSUER_URL', 'https://idp.example.com');
    vi.stubEnv('OIDC_CLIENT_ID', 'iclib');
    vi.stubEnv('OIDC_REDIRECT_URI', 'https://app.example.com/api/auth/oidc/callback');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('configuration', () => {
    it('is enabled only when issuer and client id are both set', () => {
      expect(isOidcEnabled()).toBe(true);
      vi.stubEnv('OIDC_CLIENT_ID', '');
      expect(isOidcEnabled()).toBe(false);
    });

    it('falls back to read-only for missing or invalid default role', () => {
      expect(getDefaultRole()).toBe('read-only');
      vi.stubEnv('OIDC_DEFAULT_ROLE', 'superuser');
      expect(getDefaultRole()).toBe('read-only');
      vi.stubEnv('OIDC_DEFAULT_ROLE', 'read-write');
      expect(getDefaultRole()).toBe('read-write');
    });

    it('derives the SPA redirect from the callback URI, respecting base paths', () => {
      expect(getPostLoginRedirect()).toBe('https://app.example.com');
      vi.stubEnv('OIDC_REDIRECT_URI', 'https://host.example.com/iclib/api/auth/oidc/callback');
      expect(getPostLoginRedirect()).toBe('https://host.example.com/iclib');
    });

    it('defaults provider name to SSO', () => {
      expect(getProviderName()).toBe('SSO');
      vi.stubEnv('OIDC_PROVIDER_NAME', 'Entra ID');
      expect(getProviderName()).toBe('Entra ID');
    });

    it('caches discovery for the process but retries after a failure', async () => {
      discoveryMock.mockRejectedValueOnce(new Error('idp down'));
      await expect(getOidcConfiguration()).rejects.toThrow('idp down');

      discoveryMock.mockResolvedValue({ issuer: 'ok' });
      await expect(getOidcConfiguration()).resolves.toEqual({ issuer: 'ok' });
      await getOidcConfiguration();
      expect(discoveryMock).toHaveBeenCalledTimes(2);
    });

    it('keeps a generic issuer enabled without tenant configuration', () => {
      vi.stubEnv('OIDC_ISSUER_URL', 'https://idp.example.com/common');
      vi.stubEnv('OIDC_ALLOWED_TENANTS', '');

      expect(isOidcEnabled()).toBe(true);
    });

    it('disables exact Entra common and organizations issuers without an allowlist and logs once', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.stubEnv('OIDC_ALLOWED_TENANTS', '');

      vi.stubEnv('OIDC_ISSUER_URL', 'https://login.microsoftonline.com/common/v2.0');
      expect(isOidcEnabled()).toBe(false);
      expect(isOidcEnabled()).toBe(false);

      vi.stubEnv('OIDC_ISSUER_URL', 'https://login.microsoftonline.com/organizations');
      expect(isOidcEnabled()).toBe(false);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain('[ERROR]');
      expect(errorSpy.mock.calls[0][0]).toContain('[OidcService]');
      expect(errorSpy.mock.calls[0][1]).toContain('OIDC_ALLOWED_TENANTS');
      errorSpy.mockRestore();
    });

    it('does not classify deceptive common substrings as Entra', () => {
      vi.stubEnv('OIDC_ALLOWED_TENANTS', '');

      vi.stubEnv('OIDC_ISSUER_URL', 'https://idp.example.com/login.microsoftonline.com/common');
      expect(isOidcEnabled()).toBe(true);

      vi.stubEnv('OIDC_ISSUER_URL', 'https://login.microsoftonline.com.evil.example/common');
      expect(isOidcEnabled()).toBe(true);

      vi.stubEnv('OIDC_ISSUER_URL', 'https://login.microsoftonline.com/tenant/common');
      expect(isOidcEnabled()).toBe(true);
    });
  });

  describe('buildAuthorizationRequest', () => {
    it('returns the IdP URL plus state/nonce/PKCE artifacts with S256', async () => {
      discoveryMock.mockResolvedValue({ issuer: 'config' });
      buildAuthorizationUrlMock.mockReturnValue(new URL('https://idp.example.com/authorize?client_id=iclib'));

      const request = await buildAuthorizationRequest();

      expect(request).toEqual({
        authorizationUrl: 'https://idp.example.com/authorize?client_id=iclib',
        state: 'test-state',
        nonce: 'test-nonce',
        codeVerifier: 'test-verifier',
      });
      expect(buildAuthorizationUrlMock).toHaveBeenCalledWith({ issuer: 'config' }, expect.objectContaining({
        redirect_uri: 'https://app.example.com/api/auth/oidc/callback',
        scope: 'openid profile email',
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
        state: 'test-state',
        nonce: 'test-nonce',
      }));
    });
  });

  describe('exchangeAuthorizationCode', () => {
    it('validates the transaction artifacts and maps identity claims', async () => {
      discoveryMock.mockResolvedValue({ issuer: 'config' });
      authorizationCodeGrantMock.mockResolvedValue({
        claims: () => ({
          iss: 'https://idp.example.com',
          sub: 'sub-123',
          email: 'jane@example.com',
          email_verified: true,
          preferred_username: 'jane.doe',
          name: 'Jane Doe',
        }),
      });

      const claims = await exchangeAuthorizationCode(
        'https://app.example.com/api/auth/oidc/callback?code=abc&state=test-state',
        { state: 'test-state', nonce: 'test-nonce', codeVerifier: 'test-verifier' },
      );

      expect(authorizationCodeGrantMock).toHaveBeenCalledWith(
        { issuer: 'config' },
        expect.any(URL),
        expect.objectContaining({
          pkceCodeVerifier: 'test-verifier',
          expectedState: 'test-state',
          expectedNonce: 'test-nonce',
          idTokenExpected: true,
        }),
      );
      expect(claims).toEqual(CLAIMS);
    });

    it('treats a missing email_verified claim as unverified', async () => {
      discoveryMock.mockResolvedValue({ issuer: 'config' });
      authorizationCodeGrantMock.mockResolvedValue({
        claims: () => ({ iss: 'https://idp.example.com', sub: 'sub-123' }),
      });

      const claims = await exchangeAuthorizationCode(
        'https://app.example.com/api/auth/oidc/callback?code=abc',
        { state: 's', nonce: 'n', codeVerifier: 'v' },
      );

      expect(claims.emailVerified).toBe(false);
      expect(claims.email).toBeNull();
    });

    it('returns optional tid and oid but ignores authorization claims', async () => {
      const tenantId = '11111111-2222-3333-4444-555555555555';
      const objectId = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE';
      vi.stubEnv('OIDC_ALLOWED_TENANTS', ` ${tenantId.toUpperCase()} , ${tenantId} `);
      discoveryMock.mockResolvedValue({ issuer: 'config' });
      authorizationCodeGrantMock.mockResolvedValue({
        claims: () => ({
          iss: 'https://idp.example.com',
          sub: 'sub-123',
          tid: tenantId.toUpperCase(),
          oid: objectId,
          roles: ['admin'],
          groups: ['admins'],
          wids: ['global-admin'],
        }),
      });

      const claims = await exchangeAuthorizationCode(
        'https://app.example.com/api/auth/oidc/callback?code=abc',
        { state: 's', nonce: 'n', codeVerifier: 'v' },
      );

      expect(claims.tenantId).toBe(tenantId);
      expect(claims.objectId).toBe(objectId.toLowerCase());
      expect(claims).not.toHaveProperty('roles');
      expect(claims).not.toHaveProperty('groups');
      expect(claims).not.toHaveProperty('wids');
    });

    it('rejects missing malformed and unlisted tenant ids', async () => {
      const allowedTenant = '11111111-2222-3333-4444-555555555555';
      vi.stubEnv(
        'OIDC_ISSUER_URL',
        'https://login.microsoftonline.com/11111111-2222-3333-4444-555555555555/v2.0',
      );
      vi.stubEnv('OIDC_ALLOWED_TENANTS', allowedTenant);
      discoveryMock.mockResolvedValue({ issuer: 'config' });
      authorizationCodeGrantMock
        .mockResolvedValueOnce({
          claims: () => ({ iss: 'https://issuer.example.com', sub: 'missing' }),
        })
        .mockResolvedValueOnce({
          claims: () => ({ iss: 'https://issuer.example.com', sub: 'malformed', tid: 'not-a-guid' }),
        })
        .mockResolvedValueOnce({
          claims: () => ({
            iss: 'https://issuer.example.com',
            sub: 'unlisted',
            tid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          }),
        });

      const transaction = { state: 's', nonce: 'n', codeVerifier: 'v' };
      await expect(exchangeAuthorizationCode('https://app.example.com/callback?code=1', transaction))
        .rejects.toThrow('OIDC tenant claim is required');
      await expect(exchangeAuthorizationCode('https://app.example.com/callback?code=2', transaction))
        .rejects.toThrow('OIDC tenant claim is invalid');
      await expect(exchangeAuthorizationCode('https://app.example.com/callback?code=3', transaction))
        .rejects.toThrow('OIDC tenant is not allowed');

      expect(authorizationCodeGrantMock).toHaveBeenCalledTimes(3);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe('findOrCreateOidcUser', () => {
    it('returns the user matched by (issuer, sub) without writing', async () => {
      queryMock.mockResolvedValueOnce({ rows: [ACTIVE_USER] });

      const user = await findOrCreateOidcUser(CLAIMS);

      expect(user).toEqual(ACTIVE_USER);
      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(queryMock.mock.calls[0][1]).toEqual(['https://idp.example.com', 'sub-123']);
    });

    it('rejects disabled accounts in every resolution path', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ ...ACTIVE_USER, is_active: false }] });

      await expect(findOrCreateOidcUser(CLAIMS)).rejects.toThrow('Account is disabled');
    });

    it('backfills continuity identity without changing role', async () => {
      queryMock
        .mockResolvedValueOnce({
          rows: [{ ...ACTIVE_USER, oidc_tenant_id: null, oidc_object_id: null }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...ACTIVE_USER, role: 'read-write' }] });

      const user = await findOrCreateOidcUser(CONTINUITY_CLAIMS);

      expect(user.id).toBe('user-1');
      expect(user.role).toBe('read-write');
      const [updateSql, params] = queryMock.mock.calls[2];
      expect(updateSql).toContain('oidc_tenant_id = COALESCE');
      expect(updateSql).not.toMatch(/SET[\s\S]*\brole\s*=/i);
      expect(params).toEqual([
        CONTINUITY_CLAIMS.tenantId,
        CONTINUITY_CLAIMS.objectId,
        'user-1',
        CONTINUITY_CLAIMS.issuer,
        CONTINUITY_CLAIMS.subject,
      ]);
    });

    it('rejects conflicting primary and continuity owners', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      queryMock
        .mockResolvedValueOnce({ rows: [ACTIVE_USER] })
        .mockResolvedValueOnce({ rows: [{ ...ACTIVE_USER, id: 'user-2' }] });

      await expect(findOrCreateOidcUser(CONTINUITY_CLAIMS))
        .rejects.toThrow('OIDC identity conflict');

      expect(queryMock).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain('[OidcService]');
      errorSpy.mockRestore();
    });

    it('relinks a rotated sub by issuer tenant and object while preserving local id and role', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...ACTIVE_USER, oidc_sub: 'old-sub' }] })
        .mockResolvedValueOnce({ rows: [ACTIVE_USER] });

      const user = await findOrCreateOidcUser({
        ...CONTINUITY_CLAIMS,
        email: null,
        emailVerified: false,
        subject: 'rotated-sub',
      });

      expect(user.id).toBe('user-1');
      expect(user.role).toBe('read-write');
      const [updateSql, params] = queryMock.mock.calls[2];
      expect(updateSql).toContain('SET oidc_sub = $1');
      expect(updateSql).not.toMatch(/SET[\s\S]*\brole\s*=/i);
      expect(params).toEqual([
        'rotated-sub',
        'user-1',
        CONTINUITY_CLAIMS.issuer,
        CONTINUITY_CLAIMS.tenantId,
        CONTINUITY_CLAIMS.objectId,
      ]);
    });

    it('links a verified email to exactly one non-federated local user', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [] }) // identity lookup
        .mockResolvedValueOnce({ rows: [ACTIVE_USER] }) // email match
        .mockResolvedValueOnce({ rows: [ACTIVE_USER] }); // link update

      const user = await findOrCreateOidcUser(CLAIMS);

      expect(user).toEqual(ACTIVE_USER);
      const linkSql = queryMock.mock.calls[2][0];
      expect(linkSql).toContain("auth_provider = 'oidc'");
      expect(linkSql).toContain('password_hash = NULL');
      expect(queryMock.mock.calls[2][1]).toEqual([
        'https://idp.example.com',
        'sub-123',
        null,
        null,
        'user-1',
        CLAIMS.email,
      ]);
      const emailSql = queryMock.mock.calls[1][0];
      expect(emailSql).toContain("auth_provider = 'local'");
    });

    it('never links unverified email', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [] }) // identity lookup
        .mockResolvedValueOnce({ rows: [{ ...ACTIVE_USER, username: 'jane.doe' }] }); // insert

      const user = await findOrCreateOidcUser({ ...CLAIMS, emailVerified: false });

      expect(user.username).toBe('jane.doe');
      const insertSql = queryMock.mock.calls[1][0];
      expect(insertSql).toContain('INSERT INTO users');
      expect(queryMock.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('LOWER(email)'))).toBe(false);
    });

    it('JIT uses only OIDC_DEFAULT_ROLE despite admin roles and groups claims', async () => {
      vi.stubEnv('OIDC_DEFAULT_ROLE', 'reviewer');
      queryMock
        .mockResolvedValueOnce({ rows: [] }) // identity lookup
        .mockResolvedValueOnce({ rows: [] }) // email match (none)
        .mockResolvedValueOnce({ rows: [{ ...ACTIVE_USER, role: 'reviewer' }] }); // insert

      const user = await findOrCreateOidcUser({
        ...CLAIMS,
        roles: ['admin'],
        groups: ['admins'],
        wids: ['global-admin'],
      });

      expect(user.role).toBe('reviewer');
      const [insertSql, params] = queryMock.mock.calls[2];
      expect(insertSql).toContain("'oidc'");
      expect(insertSql).not.toMatch(/roles|groups|wids/i);
      expect(params).toEqual([
        'jane.doe',
        'reviewer',
        'Jane Doe',
        'jane@example.com',
        'https://idp.example.com',
        'sub-123',
        null,
        null,
      ]);
    });

    it('generic OIDC without tid or oid still resolves', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...ACTIVE_USER, role: 'read-only' }] });

      const user = await findOrCreateOidcUser({
        ...CLAIMS,
        email: null,
        emailVerified: false,
      });

      expect(user.id).toBe('user-1');
      const [insertSql, params] = queryMock.mock.calls[1];
      expect(insertSql).toMatch(/oidc_tenant_id,\s*oidc_object_id/);
      expect(params.slice(-2)).toEqual([null, null]);
    });

    it('rejects inactive continuity matches', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...ACTIVE_USER, is_active: false }] });

      await expect(findOrCreateOidcUser(CONTINUITY_CLAIMS))
        .rejects.toThrow('Account is disabled');

      expect(queryMock.mock.calls[1][0]).toContain('oidc_tenant_id = $2');
      expect(queryMock).toHaveBeenCalledTimes(2);
    });

    it('retries with a numbered username on collision', async () => {
      const uniqueViolation = Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'users_username_key',
      });
      queryMock
        .mockResolvedValueOnce({ rows: [] }) // identity lookup
        .mockResolvedValueOnce({ rows: [] }) // email match (none)
        .mockRejectedValueOnce(uniqueViolation) // first insert collides
        .mockResolvedValueOnce({ rows: [{ ...ACTIVE_USER, username: 'jane.doe2' }] }); // retry insert

      const user = await findOrCreateOidcUser(CLAIMS);

      expect(user.username).toBe('jane.doe2');
      expect(queryMock.mock.calls[3][1][0]).toBe('jane.doe2');
    });

    it('resolves a concurrent insert of the same identity via the re-check', async () => {
      const uniqueViolation = Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'users_oidc_identity_unique',
      });
      queryMock
        .mockResolvedValueOnce({ rows: [] }) // identity lookup
        .mockResolvedValueOnce({ rows: [] }) // email match (none)
        .mockRejectedValueOnce(uniqueViolation) // insert loses the race
        .mockResolvedValueOnce({ rows: [ACTIVE_USER] }); // identity re-check wins

      const user = await findOrCreateOidcUser(CLAIMS);

      expect(user).toEqual(ACTIVE_USER);
    });

    it('resolves concurrent continuity insert safely', async () => {
      const uniqueViolation = Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'users_oidc_continuity_identity_unique',
      });
      queryMock
        .mockResolvedValueOnce({ rows: [] }) // primary identity lookup
        .mockResolvedValueOnce({ rows: [] }) // continuity identity lookup
        .mockRejectedValueOnce(uniqueViolation) // insert loses the race
        .mockResolvedValueOnce({ rows: [ACTIVE_USER] }); // continuity re-check wins

      const user = await findOrCreateOidcUser({
        ...CONTINUITY_CLAIMS,
        email: null,
        emailVerified: false,
      });

      expect(user).toEqual(ACTIVE_USER);
      expect(queryMock.mock.calls[3][0]).toContain('oidc_tenant_id = $2');
      expect(queryMock.mock.calls[3][1]).toEqual([
        CONTINUITY_CLAIMS.issuer,
        CONTINUITY_CLAIMS.tenantId,
        CONTINUITY_CLAIMS.objectId,
      ]);
    });

    it('rejects claims without issuer or subject', async () => {
      await expect(findOrCreateOidcUser({ email: 'x@y.z' })).rejects.toThrow('missing issuer or subject');
      expect(queryMock).not.toHaveBeenCalled();
    });
  });
});
