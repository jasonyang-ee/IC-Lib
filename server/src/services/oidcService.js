import * as oidcClient from 'openid-client';
import pool from '../config/database.js';

/**
 * OIDC/SSO federation (SPEC V29).
 *
 * OIDC federates identity at login only: after the IdP callback the server
 * mints the same app JWT cookie local login mints, so `authenticate`, every
 * role guard, and the client AuthContext stay untouched. IdP tokens are never
 * used as the app session and there is no server-side session storage.
 *
 * Config is env-driven; the feature is enabled iff issuer + client id are set:
 *   OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI,
 *   OIDC_SCOPES (default "openid profile email"), OIDC_PROVIDER_NAME,
 *   OIDC_DEFAULT_ROLE (default "read-only").
 */

const VALID_ROLES = new Set(['read-only', 'reviewer', 'lab', 'read-write', 'approver', 'admin']);

export const isOidcEnabled = () => Boolean(process.env.OIDC_ISSUER_URL && process.env.OIDC_CLIENT_ID);

export const getProviderName = () => process.env.OIDC_PROVIDER_NAME || 'SSO';

export const getDefaultRole = () => {
  const role = process.env.OIDC_DEFAULT_ROLE || 'read-only';
  return VALID_ROLES.has(role) ? role : 'read-only';
};

export const getScopes = () => process.env.OIDC_SCOPES || 'openid profile email';

export const getRedirectUri = () => {
  const redirectUri = process.env.OIDC_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error('OIDC_REDIRECT_URI is not set');
  }
  return redirectUri;
};

/**
 * The SPA lives at the redirect URI origin minus the API callback path, so
 * subdirectory deployments need no extra config.
 */
export const getPostLoginRedirect = () => {
  try {
    return getRedirectUri().replace(/\/api\/auth\/oidc\/callback\/?$/, '') || '/';
  } catch {
    return '/';
  }
};

// Issuer discovery is cached for the process lifetime; a failed discovery is
// not cached so a transient IdP outage recovers on the next attempt.
let discoveryPromise = null;

export const getOidcConfiguration = async () => {
  if (!isOidcEnabled()) {
    throw new Error('OIDC is not configured');
  }

  if (!discoveryPromise) {
    discoveryPromise = oidcClient.discovery(
      new URL(process.env.OIDC_ISSUER_URL),
      process.env.OIDC_CLIENT_ID,
      process.env.OIDC_CLIENT_SECRET || undefined,
    ).catch((error) => {
      discoveryPromise = null;
      throw error;
    });
  }

  return discoveryPromise;
};

/** For tests: clear the cached discovery. */
export const resetOidcConfigurationCache = () => {
  discoveryPromise = null;
};

/**
 * Build the IdP authorization URL plus the transaction artifacts
 * (state, nonce, PKCE verifier) the callback must validate.
 */
export const buildAuthorizationRequest = async () => {
  const config = await getOidcConfiguration();

  const codeVerifier = oidcClient.randomPKCECodeVerifier();
  const codeChallenge = await oidcClient.calculatePKCECodeChallenge(codeVerifier);
  const state = oidcClient.randomState();
  const nonce = oidcClient.randomNonce();

  const authorizationUrl = oidcClient.buildAuthorizationUrl(config, {
    redirect_uri: getRedirectUri(),
    scope: getScopes(),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  });

  return { authorizationUrl: authorizationUrl.href, state, nonce, codeVerifier };
};

/**
 * Exchange the authorization code (validating state, nonce, PKCE) and return
 * the identity claims the app cares about.
 */
export const exchangeAuthorizationCode = async (currentUrl, { state, nonce, codeVerifier }) => {
  const config = await getOidcConfiguration();

  const tokens = await oidcClient.authorizationCodeGrant(config, new URL(currentUrl), {
    pkceCodeVerifier: codeVerifier,
    expectedState: state,
    expectedNonce: nonce,
    idTokenExpected: true,
  });

  const claims = tokens.claims();

  return {
    issuer: claims.iss,
    subject: claims.sub,
    email: claims.email || null,
    emailVerified: claims.email_verified === true,
    preferredUsername: claims.preferred_username || null,
    displayName: claims.name || null,
  };
};

const sanitizeUsername = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9._-]/g, '')
  .slice(0, 40);

const buildUsernameCandidates = (claims) => {
  const bases = [
    sanitizeUsername(claims.preferredUsername),
    sanitizeUsername(String(claims.email || '').split('@')[0]),
    `sso-${sanitizeUsername(claims.subject).slice(0, 12)}`,
  ].filter(Boolean);

  return bases[0] || 'sso-user';
};

/**
 * Resolve the app user for a federated identity (SPEC V29):
 * 1. (issuer, sub) match -> that user.
 * 2. Verified email matching exactly one local (non-federated) user -> link
 *    the identity to it. Unverified emails never link.
 * 3. Otherwise JIT-provision with OIDC_DEFAULT_ROLE; admins elevate later.
 * Inactive accounts are rejected in all paths.
 */
export const findOrCreateOidcUser = async (claims) => {
  if (!claims?.issuer || !claims?.subject) {
    throw new Error('OIDC claims missing issuer or subject');
  }

  const existingResult = await pool.query(
    'SELECT id, username, role, is_active, display_name FROM users WHERE oidc_issuer = $1 AND oidc_sub = $2',
    [claims.issuer, claims.subject],
  );

  if (existingResult.rows.length > 0) {
    const user = existingResult.rows[0];
    if (!user.is_active) {
      throw new Error('Account is disabled');
    }
    return user;
  }

  // Account linking: only a verified email may claim an existing local user,
  // and only when it matches exactly one non-federated account.
  if (claims.email && claims.emailVerified) {
    const linkResult = await pool.query(
      'SELECT id, username, role, is_active, display_name FROM users WHERE LOWER(email) = LOWER($1) AND oidc_sub IS NULL',
      [claims.email],
    );

    if (linkResult.rows.length === 1) {
      const user = linkResult.rows[0];
      if (!user.is_active) {
        throw new Error('Account is disabled');
      }

      await pool.query(
        'UPDATE users SET oidc_issuer = $1, oidc_sub = $2 WHERE id = $3',
        [claims.issuer, claims.subject, user.id],
      );

      return user;
    }
  }

  // JIT provisioning
  const usernameBase = buildUsernameCandidates(claims);
  const role = getDefaultRole();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const username = attempt === 0 ? usernameBase : `${usernameBase}${attempt + 1}`;

    try {
      const insertResult = await pool.query(
        `INSERT INTO users (username, password_hash, role, display_name, email, auth_provider, oidc_issuer, oidc_sub)
         VALUES ($1, NULL, $2, $3, $4, 'oidc', $5, $6)
         RETURNING id, username, role, is_active, display_name`,
        [username, role, claims.displayName, claims.email, claims.issuer, claims.subject],
      );
      return insertResult.rows[0];
    } catch (error) {
      // Unique-violation on username -> try the next candidate; a concurrent
      // insert of the same federated identity resolves via the identity lookup.
      if (error.code !== '23505') {
        throw error;
      }

      const retryResult = await pool.query(
        'SELECT id, username, role, is_active, display_name FROM users WHERE oidc_issuer = $1 AND oidc_sub = $2',
        [claims.issuer, claims.subject],
      );
      if (retryResult.rows.length > 0) {
        const user = retryResult.rows[0];
        if (!user.is_active) {
          throw new Error('Account is disabled');
        }
        return user;
      }
    }
  }

  throw new Error('Could not allocate a unique username for the SSO user');
};
