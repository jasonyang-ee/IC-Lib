import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

vi.stubEnv('JWT_SECRET', 'test-secret-key-minimum-32-chars-long');
vi.stubEnv('NODE_ENV', 'test');

const queryMock = vi.fn();

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
  },
}));

const serviceMocks = vi.hoisted(() => ({
  isOidcEnabled: vi.fn(),
  getProviderName: vi.fn(() => 'Test IdP'),
  getRedirectUri: vi.fn(() => 'https://app.example.com/api/auth/oidc/callback'),
  getPostLoginRedirect: vi.fn(() => 'https://app.example.com'),
  buildAuthorizationRequest: vi.fn(),
  exchangeAuthorizationCode: vi.fn(),
  findOrCreateOidcUser: vi.fn(),
}));

vi.mock('../services/oidcService.js', () => serviceMocks);

const { AUTH_COOKIE_NAME } = await import('../middleware/auth.js');
const { oidcStatus, oidcLogin, oidcCallback } = await import('../controllers/oidcController.js');

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  res.redirect = vi.fn().mockReturnValue(res);
  return res;
};

const signStateToken = (payload = { state: 'state-1', nonce: 'nonce-1', codeVerifier: 'verifier-1' }) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10m' });

const ACTIVE_USER = {
  id: 'user-1', username: 'jane.doe', role: 'read-write', is_active: true, display_name: 'Jane Doe',
};

describe('oidcController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.isOidcEnabled.mockReturnValue(true);
    serviceMocks.getProviderName.mockReturnValue('Test IdP');
    serviceMocks.getRedirectUri.mockReturnValue('https://app.example.com/api/auth/oidc/callback');
    serviceMocks.getPostLoginRedirect.mockReturnValue('https://app.example.com');
    queryMock.mockResolvedValue({ rows: [] });
  });

  describe('oidcStatus', () => {
    it('reports the provider when enabled', () => {
      const res = mockRes();
      oidcStatus({}, res);
      expect(res.json).toHaveBeenCalledWith({ enabled: true, providerName: 'Test IdP' });
    });

    it('reports disabled without leaking a provider name', () => {
      serviceMocks.isOidcEnabled.mockReturnValue(false);
      const res = mockRes();
      oidcStatus({}, res);
      expect(res.json).toHaveBeenCalledWith({ enabled: false, providerName: null });
    });
  });

  describe('oidcLogin', () => {
    it('404s when SSO is not configured', async () => {
      serviceMocks.isOidcEnabled.mockReturnValue(false);
      const res = mockRes();

      await oidcLogin({}, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('sets a signed httpOnly state cookie and redirects to the IdP', async () => {
      serviceMocks.buildAuthorizationRequest.mockResolvedValue({
        authorizationUrl: 'https://idp.example.com/authorize?client_id=iclib',
        state: 'state-1',
        nonce: 'nonce-1',
        codeVerifier: 'verifier-1',
      });
      const res = mockRes();

      await oidcLogin({}, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'oidc_state',
        expect.any(String),
        expect.objectContaining({ httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000 }),
      );
      const stateToken = res.cookie.mock.calls[0][1];
      const decoded = jwt.verify(stateToken, process.env.JWT_SECRET);
      expect(decoded).toMatchObject({ state: 'state-1', nonce: 'nonce-1', codeVerifier: 'verifier-1' });
      expect(res.redirect).toHaveBeenCalledWith('https://idp.example.com/authorize?client_id=iclib');
    });

    it('redirects to the login error page when the IdP is unreachable', async () => {
      serviceMocks.buildAuthorizationRequest.mockRejectedValue(new Error('discovery failed'));
      const res = mockRes();

      await oidcLogin({}, res);

      expect(res.redirect).toHaveBeenCalledWith('https://app.example.com/login?error=sso_failed');
    });
  });

  describe('oidcCallback', () => {
    const callbackReq = (cookies = {}) => ({
      cookies,
      originalUrl: '/api/auth/oidc/callback?code=abc&state=state-1',
    });

    it('rejects a callback with no state cookie', async () => {
      const res = mockRes();

      await oidcCallback(callbackReq(), res);

      expect(res.clearCookie).toHaveBeenCalledWith('oidc_state', expect.any(Object));
      expect(res.redirect).toHaveBeenCalledWith('https://app.example.com/login?error=sso_failed');
      expect(serviceMocks.exchangeAuthorizationCode).not.toHaveBeenCalled();
    });

    it('rejects a callback with a tampered state cookie', async () => {
      const res = mockRes();

      await oidcCallback(callbackReq({ oidc_state: 'not-a-jwt' }), res);

      expect(res.redirect).toHaveBeenCalledWith('https://app.example.com/login?error=sso_failed');
      expect(serviceMocks.exchangeAuthorizationCode).not.toHaveBeenCalled();
    });

    it('rejects a tenant-policy failure before resolving a local user', async () => {
      serviceMocks.exchangeAuthorizationCode.mockRejectedValue(
        new Error('OIDC tenant is not allowed'),
      );
      const res = mockRes();

      await oidcCallback(callbackReq({ oidc_state: signStateToken() }), res);

      expect(serviceMocks.exchangeAuthorizationCode).toHaveBeenCalledOnce();
      expect(serviceMocks.findOrCreateOidcUser).not.toHaveBeenCalled();
      expect(queryMock).not.toHaveBeenCalled();
      expect(res.cookie.mock.calls.find(([name]) => name === AUTH_COOKIE_NAME)).toBeUndefined();
      expect(res.redirect).toHaveBeenCalledWith('https://app.example.com/login?error=sso_failed');
    });

    it('mints the standard app JWT cookie and redirects to the SPA on success', async () => {
      serviceMocks.exchangeAuthorizationCode.mockResolvedValue({
        issuer: 'https://idp.example.com', subject: 'sub-123', email: 'jane@example.com', emailVerified: true,
      });
      serviceMocks.findOrCreateOidcUser.mockResolvedValue(ACTIVE_USER);
      const res = mockRes();

      await oidcCallback(callbackReq({ oidc_state: signStateToken() }), res);

      // token exchange validated against the state-cookie transaction
      expect(serviceMocks.exchangeAuthorizationCode).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/oidc/callback?code=abc'),
        { state: 'state-1', nonce: 'nonce-1', codeVerifier: 'verifier-1' },
      );

      // the app session is the same JWT cookie local login mints (V29)
      const authCookieCall = res.cookie.mock.calls.find(([name]) => name === AUTH_COOKIE_NAME);
      expect(authCookieCall).toBeDefined();
      const session = jwt.verify(authCookieCall[1], process.env.JWT_SECRET);
      expect(session).toMatchObject({ userId: 'user-1', username: 'jane.doe', role: 'read-write' });
      expect(authCookieCall[2]).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });

      expect(queryMock.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('last_login'))).toBe(true);
      expect(res.redirect).toHaveBeenCalledWith('https://app.example.com');
    });

    it('routes a disabled account to a specific login error', async () => {
      serviceMocks.exchangeAuthorizationCode.mockResolvedValue({ issuer: 'i', subject: 's' });
      serviceMocks.findOrCreateOidcUser.mockRejectedValue(new Error('Account is disabled'));
      const res = mockRes();

      await oidcCallback(callbackReq({ oidc_state: signStateToken() }), res);

      expect(res.redirect).toHaveBeenCalledWith('https://app.example.com/login?error=account_disabled');
      const authCookieCall = res.cookie.mock.calls.find(([name]) => name === AUTH_COOKIE_NAME);
      expect(authCookieCall).toBeUndefined();
    });

    it('never 500s when the token exchange fails - lands on the login error page', async () => {
      serviceMocks.exchangeAuthorizationCode.mockRejectedValue(new Error('invalid grant'));
      const res = mockRes();

      await oidcCallback(callbackReq({ oidc_state: signStateToken() }), res);

      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.redirect).toHaveBeenCalledWith('https://app.example.com/login?error=sso_failed');
    });
  });
});
