import * as oidcClient from 'openid-client';
import pool from '../config/database.js';
import { logError } from '../utils/logger.js';

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
 *   OIDC_DEFAULT_ROLE (default "read-only"), OIDC_ALLOWED_TENANTS.
 */

const VALID_ROLES = new Set(['read-only', 'reviewer', 'lab', 'read-write', 'approver', 'admin']);
const ENTRA_PUBLIC_CLOUD_HOSTNAME = 'login.microsoftonline.com';
const TENANT_INDEPENDENT_ENTRA_PATH = /^\/(?:common|organizations)(?:\/v2\.0)?\/?$/i;
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeIdentifier = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

export const getAllowedTenants = () => [...new Set(
  String(process.env.OIDC_ALLOWED_TENANTS || '')
    .split(',')
    .map(normalizeIdentifier)
    .filter(Boolean),
)];

const parseIssuerUrl = () => {
  try {
    return new URL(process.env.OIDC_ISSUER_URL);
  } catch {
    return null;
  }
};

const isPublicCloudEntraIssuer = (issuerUrl) => Boolean(
  issuerUrl
  && issuerUrl.protocol === 'https:'
  && issuerUrl.hostname === ENTRA_PUBLIC_CLOUD_HOSTNAME
  && !issuerUrl.port
  && !issuerUrl.username
  && !issuerUrl.password,
);

const isTenantIndependentEntraIssuer = (issuerUrl) => Boolean(
  isPublicCloudEntraIssuer(issuerUrl)
  && !issuerUrl.search
  && !issuerUrl.hash
  && TENANT_INDEPENDENT_ENTRA_PATH.test(issuerUrl.pathname),
);

let loggedConfigurationError = null;

const reportConfigurationErrorOnce = (message) => {
  if (loggedConfigurationError === message) {
    return;
  }

  loggedConfigurationError = message;
  logError('OidcService', message);
};

export const isOidcEnabled = () => {
  if (!process.env.OIDC_ISSUER_URL || !process.env.OIDC_CLIENT_ID) {
    return false;
  }

  const issuerUrl = parseIssuerUrl();
  if (!issuerUrl) {
    reportConfigurationErrorOnce('OIDC configuration invalid: OIDC_ISSUER_URL must be an absolute URL');
    return false;
  }

  if (isTenantIndependentEntraIssuer(issuerUrl) && getAllowedTenants().length === 0) {
    reportConfigurationErrorOnce(
      'OIDC configuration invalid: OIDC_ALLOWED_TENANTS is required for Entra common or organizations issuers',
    );
    return false;
  }

  loggedConfigurationError = null;
  return true;
};

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
  loggedConfigurationError = null;
};

const getValidatedContinuityClaims = (claims) => {
  const tenantId = normalizeIdentifier(claims.tid);
  const objectId = normalizeIdentifier(claims.oid);
  const allowedTenants = getAllowedTenants();
  const issuerUrl = parseIssuerUrl();

  if (allowedTenants.length > 0 && !tenantId) {
    throw new Error('OIDC tenant claim is required');
  }

  if (tenantId && isPublicCloudEntraIssuer(issuerUrl) && !GUID_PATTERN.test(tenantId)) {
    throw new Error('OIDC tenant claim is invalid');
  }

  if (tenantId && allowedTenants.length > 0 && !allowedTenants.includes(tenantId)) {
    throw new Error('OIDC tenant is not allowed');
  }

  return { tenantId, objectId };
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
  const { tenantId, objectId } = getValidatedContinuityClaims(claims);

  return {
    issuer: claims.iss,
    subject: claims.sub,
    email: claims.email || null,
    emailVerified: claims.email_verified === true,
    preferredUsername: claims.preferred_username || null,
    displayName: claims.name || null,
    tenantId,
    objectId,
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

const USER_IDENTITY_COLUMNS = `
  id,
  username,
  role,
  is_active,
  display_name,
  auth_provider,
  oidc_issuer,
  oidc_sub,
  oidc_tenant_id,
  oidc_object_id
`;

const PRIMARY_IDENTITY_CONSTRAINT = 'users_oidc_identity_unique';
const CONTINUITY_IDENTITY_CONSTRAINT = 'users_oidc_continuity_identity_unique';
const USERNAME_CONSTRAINT = 'users_username_key';

const hasContinuityIdentity = (claims) => Boolean(claims.tenantId && claims.objectId);

const requireActiveUser = (user) => {
  if (!user.is_active) {
    throw new Error('Account is disabled');
  }
  return user;
};

const findUserByPrimaryIdentity = async (claims) => pool.query(
  `SELECT ${USER_IDENTITY_COLUMNS}
   FROM users
   WHERE oidc_issuer = $1 AND oidc_sub = $2`,
  [claims.issuer, claims.subject],
);

const findUserByContinuityIdentity = async (claims) => pool.query(
  `SELECT ${USER_IDENTITY_COLUMNS}
   FROM users
   WHERE oidc_issuer = $1
     AND oidc_tenant_id = $2
     AND oidc_object_id = $3`,
  [claims.issuer, claims.tenantId, claims.objectId],
);

const rejectIdentityConflict = () => {
  logError(
    'OidcService',
    'OIDC identity conflict: primary and continuity identities belong to different users',
  );
  throw new Error('OIDC identity conflict');
};

const resolveIdentityUniqueViolation = async (error, claims) => {
  if (error?.code !== '23505') {
    throw error;
  }

  if (error.constraint === PRIMARY_IDENTITY_CONSTRAINT) {
    return findUserByPrimaryIdentity(claims);
  }

  if (error.constraint === CONTINUITY_IDENTITY_CONSTRAINT && hasContinuityIdentity(claims)) {
    return findUserByContinuityIdentity(claims);
  }

  throw error;
};

/**
 * Resolve the app user for a federated identity (SPEC V29):
 * 1. (issuer, sub) match -> that user.
 * 2. (issuer, tenant, object) match -> relink a rotated sub.
 * 3. Verified email matching exactly one local (non-federated) user -> link
 *    the identity to it. Unverified emails never link.
 * 4. Otherwise JIT-provision with OIDC_DEFAULT_ROLE; admins elevate later.
 * Inactive accounts are rejected in all paths.
 */
export const findOrCreateOidcUser = async (claims) => {
  if (!claims?.issuer || !claims?.subject) {
    throw new Error('OIDC claims missing issuer or subject');
  }

  const existingResult = await findUserByPrimaryIdentity(claims);

  if (existingResult.rows.length > 0) {
    const user = requireActiveUser(existingResult.rows[0]);

    if (!hasContinuityIdentity(claims)) {
      return user;
    }

    const continuityResult = await findUserByContinuityIdentity(claims);
    if (continuityResult.rows.length > 0) {
      if (continuityResult.rows[0].id !== user.id) {
        rejectIdentityConflict();
      }
      return user;
    }

    const tenantMatches = user.oidc_tenant_id == null
      || user.oidc_tenant_id === claims.tenantId;
    const objectMatches = user.oidc_object_id == null
      || user.oidc_object_id === claims.objectId;

    if (!tenantMatches || !objectMatches) {
      rejectIdentityConflict();
    }

    try {
      const backfillResult = await pool.query(
        `UPDATE users
         SET oidc_tenant_id = COALESCE(oidc_tenant_id, $1),
             oidc_object_id = COALESCE(oidc_object_id, $2)
         WHERE id = $3
           AND oidc_issuer = $4
           AND oidc_sub = $5
           AND (oidc_tenant_id IS NULL OR oidc_tenant_id = $1)
           AND (oidc_object_id IS NULL OR oidc_object_id = $2)
         RETURNING ${USER_IDENTITY_COLUMNS}`,
        [claims.tenantId, claims.objectId, user.id, claims.issuer, claims.subject],
      );

      if (backfillResult.rows.length === 0) {
        rejectIdentityConflict();
      }

      return requireActiveUser(backfillResult.rows[0]);
    } catch (error) {
      if (error?.code !== '23505' || error.constraint !== CONTINUITY_IDENTITY_CONSTRAINT) {
        throw error;
      }

      const racedContinuityResult = await findUserByContinuityIdentity(claims);
      if (racedContinuityResult.rows[0]?.id === user.id) {
        return requireActiveUser(racedContinuityResult.rows[0]);
      }
      rejectIdentityConflict();
    }
  }

  if (hasContinuityIdentity(claims)) {
    const continuityResult = await findUserByContinuityIdentity(claims);
    if (continuityResult.rows.length > 0) {
      const user = requireActiveUser(continuityResult.rows[0]);

      try {
        const relinkResult = await pool.query(
          `UPDATE users
           SET oidc_sub = $1
           WHERE id = $2
             AND oidc_issuer = $3
             AND oidc_tenant_id = $4
             AND oidc_object_id = $5
           RETURNING ${USER_IDENTITY_COLUMNS}`,
          [claims.subject, user.id, claims.issuer, claims.tenantId, claims.objectId],
        );

        if (relinkResult.rows.length === 0) {
          rejectIdentityConflict();
        }

        return requireActiveUser(relinkResult.rows[0]);
      } catch (error) {
        if (error?.code !== '23505' || error.constraint !== PRIMARY_IDENTITY_CONSTRAINT) {
          throw error;
        }

        const racedPrimaryResult = await findUserByPrimaryIdentity(claims);
        if (racedPrimaryResult.rows[0]?.id === user.id) {
          return requireActiveUser(racedPrimaryResult.rows[0]);
        }
        rejectIdentityConflict();
      }
    }
  }

  // Account linking: only a verified email may claim an existing local user,
  // and only when it matches exactly one non-federated account.
  if (claims.email && claims.emailVerified) {
    const linkResult = await pool.query(
      `SELECT ${USER_IDENTITY_COLUMNS}
       FROM users
       WHERE LOWER(email) = LOWER($1)
         AND auth_provider = 'local'
         AND oidc_issuer IS NULL
         AND oidc_sub IS NULL`,
      [claims.email],
    );

    if (linkResult.rows.length === 1) {
      const user = requireActiveUser(linkResult.rows[0]);

      try {
        const linkedResult = await pool.query(
          `UPDATE users
           SET auth_provider = 'oidc',
               password_hash = NULL,
               oidc_issuer = $1,
               oidc_sub = $2,
               oidc_tenant_id = $3,
               oidc_object_id = $4
           WHERE id = $5
             AND auth_provider = 'local'
             AND LOWER(email) = LOWER($6)
             AND oidc_issuer IS NULL
             AND oidc_sub IS NULL
           RETURNING ${USER_IDENTITY_COLUMNS}`,
          [claims.issuer, claims.subject, claims.tenantId, claims.objectId, user.id, claims.email],
        );

        if (linkedResult.rows.length === 0) {
          rejectIdentityConflict();
        }
        return requireActiveUser(linkedResult.rows[0]);
      } catch (error) {
        const racedIdentityResult = await resolveIdentityUniqueViolation(error, claims);
        if (racedIdentityResult.rows[0]?.id === user.id) {
          return requireActiveUser(racedIdentityResult.rows[0]);
        }
        rejectIdentityConflict();
      }
    }
  }

  // JIT provisioning
  const usernameBase = buildUsernameCandidates(claims);
  const role = getDefaultRole();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const username = attempt === 0 ? usernameBase : `${usernameBase}${attempt + 1}`;

    try {
      const insertResult = await pool.query(
        `INSERT INTO users (
           username,
           password_hash,
           role,
           display_name,
           email,
           auth_provider,
           oidc_issuer,
           oidc_sub,
           oidc_tenant_id,
           oidc_object_id
         )
         VALUES ($1, NULL, $2, $3, $4, 'oidc', $5, $6, $7, $8)
         RETURNING ${USER_IDENTITY_COLUMNS}`,
        [
          username,
          role,
          claims.displayName,
          claims.email,
          claims.issuer,
          claims.subject,
          claims.tenantId,
          claims.objectId,
        ],
      );
      return requireActiveUser(insertResult.rows[0]);
    } catch (error) {
      if (error.code !== '23505') {
        throw error;
      }

      if (error.constraint === USERNAME_CONSTRAINT) {
        continue;
      }

      if (
        error.constraint !== PRIMARY_IDENTITY_CONSTRAINT
        && error.constraint !== CONTINUITY_IDENTITY_CONSTRAINT
      ) {
        throw error;
      }

      const retryResult = await resolveIdentityUniqueViolation(error, claims);
      if (retryResult.rows.length > 0) {
        return requireActiveUser(retryResult.rows[0]);
      }

      throw error;
    }
  }

  throw new Error('Could not allocate a unique username for the SSO user');
};
