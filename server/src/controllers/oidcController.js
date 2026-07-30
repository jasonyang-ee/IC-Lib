import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { AUTH_COOKIE_NAME, generateToken, getAuthCookieOptions } from '../middleware/auth.js';
import { logActivity, logUserActivity } from '../services/activityLogService.js';
import {
  buildAuthorizationRequest,
  exchangeAuthorizationCode,
  findOrCreateOidcUser,
  getPostLoginRedirect,
  getProviderName,
  getRedirectUri,
  isOidcEnabled,
} from '../services/oidcService.js';
import { logError } from '../utils/logger.js';

const OIDC_STATE_COOKIE = 'oidc_state';
const STATE_TTL = '10m';

// The state cookie carries the transaction artifacts (state, nonce, PKCE
// verifier) JWT-signed for integrity + expiry; httpOnly and SameSite=lax so
// it survives the top-level redirect back from the IdP.
const getStateCookieOptions = ({ clear = false } = {}) => {
  const options = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
  if (!clear) {
    options.maxAge = 10 * 60 * 1000;
  }
  return options;
};

const redirectToLoginError = (res, code = 'sso_failed') => {
  const base = getPostLoginRedirect().replace(/\/$/, '');
  return res.redirect(`${base}/login?error=${encodeURIComponent(code)}`);
};

/** Public: tells the login page whether to render the SSO button. */
export const oidcStatus = (req, res) => {
  res.json({
    enabled: isOidcEnabled(),
    providerName: isOidcEnabled() ? getProviderName() : null,
  });
};

/** Public: starts the Authorization Code + PKCE flow with a 302 to the IdP. */
export const oidcLogin = async (req, res) => {
  if (!isOidcEnabled()) {
    return res.status(404).json({ error: 'SSO is not configured' });
  }

  try {
    const { authorizationUrl, state, nonce, codeVerifier } = await buildAuthorizationRequest();

    const stateToken = jwt.sign(
      { state, nonce, codeVerifier },
      process.env.JWT_SECRET,
      { expiresIn: STATE_TTL },
    );

    res.cookie(OIDC_STATE_COOKIE, stateToken, getStateCookieOptions());
    res.redirect(authorizationUrl);
  } catch (error) {
    logError('OIDC', 'Failed to start SSO login:', error.message);
    redirectToLoginError(res);
  }
};

/**
 * Public: IdP redirect target. Validates state/nonce/PKCE, resolves the app
 * user (JIT/link per SPEC V29), and mints the standard app JWT cookie.
 * Errors always land on /login?error=... — never a bare 500 page.
 */
export const oidcCallback = async (req, res) => {
  if (!isOidcEnabled()) {
    return redirectToLoginError(res);
  }

  const stateToken = req.cookies?.[OIDC_STATE_COOKIE];
  res.clearCookie(OIDC_STATE_COOKIE, getStateCookieOptions({ clear: true }));

  let transaction = null;
  try {
    transaction = jwt.verify(stateToken, process.env.JWT_SECRET);
  } catch {
    logError('OIDC', 'Callback with missing or invalid state cookie');
    return redirectToLoginError(res);
  }

  try {
    // Reconstruct the exact callback URL from the configured redirect URI so
    // proxy/origin rewrites can't desync what the token exchange validates.
    const redirectUri = new URL(getRedirectUri());
    const currentUrl = new URL(req.originalUrl, redirectUri.origin);

    const claims = await exchangeAuthorizationCode(currentUrl.href, {
      state: transaction.state,
      nonce: transaction.nonce,
      codeVerifier: transaction.codeVerifier,
    });

    const user = await findOrCreateOidcUser(claims);

    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    try {
      await logUserActivity(pool, {
        typeName: 'user_login',
        description: `User ${user.username} logged in via SSO (${getProviderName()})`,
        userId: user.id,
      });
      await logActivity(pool, {
        userId: user.id,
        activityType: 'user_login',
        details: { username: user.username, role: user.role, sso: true },
      });
    } catch (activityError) {
      logError('OIDC', 'Failed to log SSO login activity:', activityError.message);
    }

    const token = generateToken(user);
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    res.redirect(getPostLoginRedirect());
  } catch (error) {
    if (error.message === 'Account is disabled') {
      logError('OIDC', 'SSO login rejected: account disabled');
      return redirectToLoginError(res, 'account_disabled');
    }
    logError('OIDC', 'SSO callback failed:', error.message);
    redirectToLoginError(res);
  }
};
