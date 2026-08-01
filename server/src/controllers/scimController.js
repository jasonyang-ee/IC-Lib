import pool from '../config/database.js';
import { logError, logWarn } from '../utils/logger.js';
import { logUserActivity } from '../services/activityLogService.js';
import { scimError } from '../middleware/scimAuth.js';
import {
  SCIM_BASE_PATH,
  SCIM_CONTENT_TYPE,
  SCIM_USER_SCHEMA,
  canonicalizeScimGuid,
  getScimTenantId,
  parseScimPatch,
  parseScimResource,
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
 *    never be read or written through this endpoint;
 *  - an unknown identity is an empty result, not an error. Entra's Test
 *    Connection probes with a random GUID and expects 200.
 *
 * The mutation half never creates or links an account: local rows come from
 * OIDC first login (§V57). SCIM may only update the profile and the active
 * flag of a row that already exists, and removal is deactivation, so audit and
 * approval history keep resolving.
 */

const SELECT_USER_FIELDS = 'id, username, display_name, email, is_active, oidc_object_id';

const scimJson = (res, status, body) => res.status(status).type(SCIM_CONTENT_TYPE).json(body);

/**
 * Every read and write goes through this predicate: the row must carry the
 * configured tenant and an object id, so an unlinked or foreign-tenant account
 * is invisible to SCIM.
 */
const findLinkedUser = (where, params) => pool.query(
  `SELECT ${SELECT_USER_FIELDS} FROM users
   WHERE ${where} AND oidc_tenant_id = $${params.length + 1} AND oidc_object_id IS NOT NULL`,
  [...params, getScimTenantId()],
);

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

export const SCIM_USER_RESOURCE_TYPE = {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
  id: 'User',
  name: 'User',
  endpoint: '/Users',
  description: 'User Account',
  schema: SCIM_USER_SCHEMA,
  meta: { resourceType: 'ResourceType', location: `${SCIM_BASE_PATH}/ResourceTypes/User` },
};

export const getResourceTypes = (_req, res) => scimJson(
  res,
  200,
  toScimListResponse([SCIM_USER_RESOURCE_TYPE]),
);

export const getResourceTypeById = (req, res) => {
  if (req.params.id !== SCIM_USER_RESOURCE_TYPE.id) {
    return scimError(res, 404, 'Resource type not found');
  }
  return scimJson(res, 200, SCIM_USER_RESOURCE_TYPE);
};

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

export const SCIM_USER_SCHEMA_RESOURCE = {
  id: SCIM_USER_SCHEMA,
  name: 'User',
  description: 'User Account',
  attributes: [
    attribute('userName', { required: true, uniqueness: 'server' }),
    attribute('externalId', { caseExact: true, mutability: 'readOnly', uniqueness: 'server' }),
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
};

export const getSchemas = (_req, res) => scimJson(
  res,
  200,
  toScimListResponse([SCIM_USER_SCHEMA_RESOURCE]),
);

export const getSchemaById = (req, res) => {
  if (req.params.id !== SCIM_USER_SCHEMA_RESOURCE.id) {
    return scimError(res, 404, 'Schema not found');
  }
  return scimJson(res, 200, SCIM_USER_SCHEMA_RESOURCE);
};

export const listUsers = async (req, res) => {
  const filter = parseUserFilter(req.query.filter);
  if (filter.error) {
    return scimError(res, 400, filter.error, 'invalidFilter');
  }

  let result;
  try {
    result = await findLinkedUser('oidc_object_id = $1', [filter.externalId]);
  } catch (error) {
    return queryFailed(res, 'User lookup by externalId', error);
  }

  // Deliberately a 200 with an empty Resources array for an unknown identity.
  return scimJson(res, 200, toScimListResponse(result.rows.map(toScimUser)));
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  const userId = canonicalizeScimGuid(id);
  if (!userId) {
    return scimError(res, 404, 'User not found');
  }

  let result;
  try {
    result = await findLinkedUser('id = $1', [userId]);
  } catch (error) {
    return queryFailed(res, 'User lookup by id', error);
  }

  if (result.rows.length === 0) {
    return scimError(res, 404, 'User not found');
  }

  return scimJson(res, 200, toScimUser(result.rows[0]));
};

/**
 * The lifecycle audit row is written after the user row is already committed
 * and can never fail the operation: cutoff must not wait on the audit table
 * (§V1 stops the session on the next protected request either way).
 */
const recordLifecycle = async (description, userId = null) => {
  try {
    await logUserActivity(pool, { typeName: 'scim_provisioning', description, userId });
  } catch (activityError) {
    logError('SCIM', 'Failed to log provisioning activity:', activityError.message);
  }
};

/**
 * Apply the parsed changes, skipping columns already at the requested value so
 * a replayed request is a genuine no-op. Column names come from the service's
 * fixed writable map, never from the payload.
 */
const applyChanges = async (row, changes) => {
  const entries = Object.entries(changes).filter(([column, value]) => row[column] !== value);
  if (entries.length === 0) {
    return row;
  }

  const assignments = entries.map(([column], index) => `${column} = $${index + 1}`);
  const values = entries.map(([, value]) => value);
  const result = await pool.query(
    `UPDATE users SET ${assignments.join(', ')} WHERE id = $${values.length + 1}
     RETURNING ${SELECT_USER_FIELDS}`,
    [...values, row.id],
  );

  return result.rows[0];
};

/** A duplicate username is the caller's conflict to resolve, not a 500. */
const writeFailed = (res, context, error) => {
  if (error.code === '23505') {
    return scimError(res, 409, 'userName is already in use', 'uniqueness');
  }
  return queryFailed(res, context, error);
};

export const createUser = async (req, res) => {
  const { externalId, ...attributes } = req.body ?? {};
  const canonicalExternalId = canonicalizeScimGuid(externalId);

  if (!canonicalExternalId) {
    return scimError(res, 400, 'externalId must be the Entra objectId', 'invalidValue');
  }

  const parsed = parseScimResource(attributes);
  if (parsed.error) {
    return scimError(res, 400, parsed.error.detail, parsed.error.scimType);
  }

  let existing;
  try {
    existing = await findLinkedUser('oidc_object_id = $1', [canonicalExternalId]);
  } catch (error) {
    return queryFailed(res, 'User lookup for create', error);
  }

  // §V60: this endpoint never creates or links an account. An unknown identity
  // means the person has not signed in through SSO yet; the operator's fix is
  // one OIDC login followed by a provisioning retry, so the refusal is visible
  // rather than a silent no-op.
  if (existing.rows.length === 0) {
    logWarn('SCIM', `Provisioning refused for unlinked identity ${canonicalExternalId}`);
    await recordLifecycle(`SCIM create refused for unlinked identity ${canonicalExternalId}`);
    return scimError(
      res,
      403,
      'This endpoint does not create users. The user must sign in with SSO first.',
    );
  }

  let updated;
  try {
    updated = await applyChanges(existing.rows[0], parsed.changes);
  } catch (error) {
    return writeFailed(res, 'User create-as-update', error);
  }

  await recordLifecycle(`SCIM provisioned existing user ${updated.username}`, updated.id);
  const representation = toScimUser(updated);
  return res.status(201).set('Location', representation.meta.location)
    .type(SCIM_CONTENT_TYPE).json(representation);
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const userId = canonicalizeScimGuid(id);
  if (!userId) {
    return scimError(res, 404, 'User not found');
  }

  const parsed = parseScimPatch(req.body);
  if (parsed.error) {
    return scimError(res, 400, parsed.error.detail, parsed.error.scimType);
  }

  let existing;
  try {
    existing = await findLinkedUser('id = $1', [userId]);
  } catch (error) {
    return queryFailed(res, 'User lookup for patch', error);
  }

  if (existing.rows.length === 0) {
    return scimError(res, 404, 'User not found');
  }

  let updated;
  try {
    updated = await applyChanges(existing.rows[0], parsed.changes);
  } catch (error) {
    return writeFailed(res, 'User patch', error);
  }

  if (updated.is_active !== existing.rows[0].is_active) {
    await recordLifecycle(
      `SCIM set user ${updated.username} ${updated.is_active ? 'active' : 'inactive'}`,
      updated.id,
    );
  }

  return scimJson(res, 200, toScimUser(updated));
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;
  const userId = canonicalizeScimGuid(id);
  if (!userId) {
    return scimError(res, 404, 'User not found');
  }

  // §V57: removal deactivates and retains the row so historical authorship,
  // approvals and audit references survive. Repeating it stays a 204.
  let result;
  try {
    result = await pool.query(
      `UPDATE users SET is_active = false
       WHERE id = $1 AND oidc_tenant_id = $2 AND oidc_object_id IS NOT NULL
       RETURNING id, username`,
      [userId, getScimTenantId()],
    );
  } catch (error) {
    return queryFailed(res, 'User deactivation', error);
  }

  if (result.rows.length === 0) {
    return scimError(res, 404, 'User not found');
  }

  await recordLifecycle(`SCIM deactivated user ${result.rows[0].username}`, result.rows[0].id);
  return res.status(204).end();
};
