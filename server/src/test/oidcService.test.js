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

    it('links a verified email to exactly one non-federated local user', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [] }) // identity lookup
        .mockResolvedValueOnce({ rows: [ACTIVE_USER] }) // email match
        .mockResolvedValueOnce({ rows: [] }); // link update

      const user = await findOrCreateOidcUser(CLAIMS);

      expect(user).toEqual(ACTIVE_USER);
      const linkSql = queryMock.mock.calls[2][0];
      expect(linkSql).toContain('UPDATE users SET oidc_issuer');
      expect(queryMock.mock.calls[2][1]).toEqual(['https://idp.example.com', 'sub-123', 'user-1']);
      const emailSql = queryMock.mock.calls[1][0];
      expect(emailSql).toContain('oidc_sub IS NULL');
    });

    it('never links an unverified email - JIT provisions instead', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [] }) // identity lookup
        .mockResolvedValueOnce({ rows: [{ ...ACTIVE_USER, username: 'jane.doe' }] }); // insert

      const user = await findOrCreateOidcUser({ ...CLAIMS, emailVerified: false });

      expect(user.username).toBe('jane.doe');
      const insertSql = queryMock.mock.calls[1][0];
      expect(insertSql).toContain('INSERT INTO users');
      expect(queryMock.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('LOWER(email)'))).toBe(false);
    });

    it('JIT-provisions with the default role and oidc provider fields', async () => {
      vi.stubEnv('OIDC_DEFAULT_ROLE', 'reviewer');
      queryMock
        .mockResolvedValueOnce({ rows: [] }) // identity lookup
        .mockResolvedValueOnce({ rows: [] }) // email match (none)
        .mockResolvedValueOnce({ rows: [{ ...ACTIVE_USER, role: 'reviewer' }] }); // insert

      const user = await findOrCreateOidcUser(CLAIMS);

      expect(user.role).toBe('reviewer');
      const [insertSql, params] = queryMock.mock.calls[2];
      expect(insertSql).toContain("'oidc'");
      expect(params).toEqual(['jane.doe', 'reviewer', 'Jane Doe', 'jane@example.com', 'https://idp.example.com', 'sub-123']);
    });

    it('retries with a numbered username on collision', async () => {
      const uniqueViolation = Object.assign(new Error('duplicate key'), { code: '23505' });
      queryMock
        .mockResolvedValueOnce({ rows: [] }) // identity lookup
        .mockResolvedValueOnce({ rows: [] }) // email match (none)
        .mockRejectedValueOnce(uniqueViolation) // first insert collides
        .mockResolvedValueOnce({ rows: [] }) // identity re-check (not concurrent)
        .mockResolvedValueOnce({ rows: [{ ...ACTIVE_USER, username: 'jane.doe2' }] }); // retry insert

      const user = await findOrCreateOidcUser(CLAIMS);

      expect(user.username).toBe('jane.doe2');
      expect(queryMock.mock.calls[4][1][0]).toBe('jane.doe2');
    });

    it('resolves a concurrent insert of the same identity via the re-check', async () => {
      const uniqueViolation = Object.assign(new Error('duplicate key'), { code: '23505' });
      queryMock
        .mockResolvedValueOnce({ rows: [] }) // identity lookup
        .mockResolvedValueOnce({ rows: [] }) // email match (none)
        .mockRejectedValueOnce(uniqueViolation) // insert loses the race
        .mockResolvedValueOnce({ rows: [ACTIVE_USER] }); // identity re-check wins

      const user = await findOrCreateOidcUser(CLAIMS);

      expect(user).toEqual(ACTIVE_USER);
    });

    it('rejects claims without issuer or subject', async () => {
      await expect(findOrCreateOidcUser({ email: 'x@y.z' })).rejects.toThrow('missing issuer or subject');
      expect(queryMock).not.toHaveBeenCalled();
    });
  });
});
