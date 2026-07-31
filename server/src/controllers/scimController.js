import pool from '../config/database.js';
import { logError } from '../utils/logger.js';
import { scimError } from '../middleware/scimAuth.js';
import {
  SCIM_BASE_PATH,
  SCIM_CONTENT_TYPE,
  SCIM_USER_SCHEMA,
  getScimTenantId,
  isUuid,
  parseUserFilter,
  toScimListResponse,
  toScimUser,
} from '../services/scimService.js';

/**
 * §V60/§I12: the read half of the Entra SCIM surface - discovery plus lookup of
 * users that OIDC login has already linked. Every route here is mounted behind
 * `authenticateScim`, so there is no per-handler authorization check.
 *
 * Two rules shape the queries below:
 *  - a user is visible to SCIM only when the row carries BOTH the configured
 *    tenant id and an object id, so an unlinked or foreign-tenant account can
 *    never be read or (in F9.T4) written through this endpoint;
 *  - an unknown identity is an empty result, not an error. Entra's Test
 *    Connection probes with a random GUID and expects 200.
 */

const SELECT_USER_FIELDS = 'id, username, display_name, email, is_active, oidc_object_id';

const scimJson = (res, status, body) => res.status(status).type(SCIM_CONTENT_TYPE).json(body);

/** Any driver failure is a generic SCIM 500; the cause goes to the log only. */
const queryFailed = (res, context, error) => {
  logError('SCIM', `${context} failed:`, error.message);
  return scimError(res, 500, 'Internal server error');
};

export const getServiceProviderConfig = (_req, res) => scimJson(res, 200, {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
  patch: { supported: true },
  bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
  filter: { supported: true, maxResults: 1 },
  changePassword: { supported: false },
  sort: { supported: false },
  etag: { supported: false },
  authenticationSchemes: [{
    type: 'oauthbearertoken',
    name: 'OAuth Bearer Token',
    description: 'Authentication with a pre-shared bearer token.',
    primary: true,
  }],
  meta: {
    resourceType: 'ServiceProviderConfig',
    location: `${SCIM_BASE_PATH}/ServiceProviderConfig`,
  },
});

export const getResourceTypes = (_req, res) => scimJson(res, 200, toScimListResponse([{
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
  id: 'User',
  name: 'User',
  endpoint: '/Users',
  description: 'User Account',
  schema: SCIM_USER_SCHEMA,
  meta: { resourceType: 'ResourceType', location: `${SCIM_BASE_PATH}/ResourceTypes/User` },
}]));

// Only the attributes this provider actually honours are advertised: userName
// and active are required, displayName and emails are the optional profile
// fields SCIM may write (§V60). Nothing here maps to role or credentials.
export const getSchemas = (_req, res) => scimJson(res, 200, toScimListResponse([{
  id: SCIM_USER_SCHEMA,
  name: 'User',
  description: 'User Account',
  attributes: [
    attribute('userName', { required: true, uniqueness: 'server' }),
    attribute('displayName'),
    attribute('active', { type: 'boolean', required: true }),
    {
      name: 'emails',
      type: 'complex',
      multiValued: true,
      required: false,
      mutability: 'readWrite',
      returned: 'default',
      subAttributes: [
        attribute('value'),
        attribute('type'),
        { ...attribute('primary'), type: 'boolean' },
      ],
    },
  ],
  meta: { resourceType: 'Schema', location: `${SCIM_BASE_PATH}/Schemas/${SCIM_USER_SCHEMA}` },
}]));

function attribute(name, overrides = {}) {
  return {
    name,
    type: 'string',
    multiValued: false,
    required: false,
    caseExact: false,
    mutability: 'readWrite',
    returned: 'default',
    uniqueness: 'none',
    ...overrides,
  };
}

export const listUsers = async (req, res) => {
  const filter = parseUserFilter(req.query.filter);
  if (filter.error) {
    return scimError(res, 400, filter.error, 'invalidFilter');
  }

  let result;
  try {
    result = await pool.query(
      `SELECT ${SELECT_USER_FIELDS} FROM users
       WHERE oidc_tenant_id = $1 AND oidc_object_id = $2`,
      [getScimTenantId(), filter.externalId],
    );
  } catch (error) {
    return queryFailed(res, 'User lookup by externalId', error);
  }

  // Deliberately a 200 with an empty Resources array for an unknown identity.
  return scimJson(res, 200, toScimListResponse(result.rows.map(toScimUser)));
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) {
    return scimError(res, 404, 'User not found');
  }

  let result;
  try {
    result = await pool.query(
      `SELECT ${SELECT_USER_FIELDS} FROM users
       WHERE id = $1 AND oidc_tenant_id = $2 AND oidc_object_id IS NOT NULL`,
      [id, getScimTenantId()],
    );
  } catch (error) {
    return queryFailed(res, 'User lookup by id', error);
  }

  if (result.rows.length === 0) {
    return scimError(res, 404, 'User not found');
  }

  return scimJson(res, 200, toScimUser(result.rows[0]));
};
