import crypto from 'crypto';
import {
  SCIM_CONTENT_TYPE,
  getScimBearerToken,
  isScimEnabled,
} from '../services/scimService.js';

const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';

/** SCIM error body. Deliberately terse: these responses go to an IdP, not a user. */
export const scimError = (res, status, detail, scimType) => {
  const body = { schemas: [SCIM_ERROR_SCHEMA], status: String(status), detail };
  if (scimType) {
    body.scimType = scimType;
  }

  return res.status(status).type(SCIM_CONTENT_TYPE).json(body);
};

/**
 * §V60/§V27: the only gate on `/api/scim/v2/*`. Service auth, not user auth -
 * there is no cookie fallback, because a browser session must never be able to
 * drive provisioning.
 */
export const authenticateScim = (req, res, next) => {
  // A disabled feature must not be distinguishable from a wrong credential.
  if (!isScimEnabled()) {
    return scimError(res, 404, 'Not found');
  }

  const header = req.headers.authorization;
  const presented = typeof header === 'string' && header.startsWith('Bearer ')
    ? header.substring(7)
    : null;

  if (!presented || !constantTimeEquals(presented, getScimBearerToken())) {
    res.set('WWW-Authenticate', 'Bearer realm="scim"');
    return scimError(res, 401, 'Unauthorized');
  }

  next();
};

/**
 * timingSafeEqual throws on a length mismatch, and the length difference is
 * itself observable, so compare fixed-width digests of both values instead.
 */
function constantTimeEquals(presented, expected) {
  const presentedDigest = crypto.createHash('sha256').update(String(presented)).digest();
  const expectedDigest = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(presentedDigest, expectedDigest);
}
