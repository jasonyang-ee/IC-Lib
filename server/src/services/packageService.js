import pool from '../config/database.js';

const COUNT_POLICIES = new Set(['chip', 'embedded', 'none', 'append']);
const MODIFIER_STOPLIST = ['exposed pad', 'e-pad', 'ep', 'thin', 'wide', 'narrow', 'shrink'];
const DIMENSIONAL_NOTE_PATTERN = /\s*\((?=[^)]*(?:mm|cm|mil|inch|inches|width|height|length|pitch|dia|diameter|body|thick|od|id|["']))[^)]*\)\s*$/i;
const IPC_DIMENSIONAL_PATTERN = /^([A-Za-z]+)\d+P\d+X\d+X\d+-(\d+)([MNL])$/i;

export class PackageServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PackageServiceError';
    this.status = status;
  }
}

const packageColumns = `
  p.id,
  p.short_name,
  p.family,
  p.mount,
  p.count_policy,
  p.is_builtin,
  p.is_active,
  p.display_order
`;

const packageWithAliasesQuery = `
  SELECT
    ${packageColumns},
    COALESCE(
      json_agg(json_build_object('id', pa.id, 'alias', pa.alias) ORDER BY pa.alias)
        FILTER (WHERE pa.id IS NOT NULL),
      '[]'::json
    ) AS aliases
  FROM packages p
  LEFT JOIN package_aliases pa ON pa.package_id = p.id
`;

const trimText = (value) => (typeof value === 'string' ? value.trim() : '');

export const foldAliasKey = (value) => trimText(value).replace(/[^A-Za-z0-9]/g, '').toLowerCase();

export const sanitizePackageInput = (raw) => {
  let value = trimText(raw);
  while (DIMENSIONAL_NOTE_PATTERN.test(value)) {
    value = value.replace(DIMENSIONAL_NOTE_PATTERN, '').trim();
  }
  return value;
};

const normalizeOptionalText = (value, field) => {
  if (value == null) return null;
  if (typeof value !== 'string') throw new PackageServiceError(`${field} must be a string`);
  return value.trim() || null;
};

const normalizeCountPolicy = (value) => {
  if (typeof value !== 'string' || !COUNT_POLICIES.has(value)) {
    throw new PackageServiceError('count_policy must be chip, embedded, none, or append');
  }
  return value;
};

const normalizeDisplayOrder = (value) => {
  if (value == null) return null;
  if (!Number.isInteger(value)) throw new PackageServiceError('display_order must be an integer');
  return value;
};

const normalizeAlias = (value) => {
  const alias = trimText(value);
  if (!alias) throw new PackageServiceError('Alias is required');
  if (!foldAliasKey(alias)) throw new PackageServiceError('Alias must contain letters or numbers');
  return alias;
};

const getPackageById = async (db, id, { includeInactive = false } = {}) => {
  const activeFilter = includeInactive ? '' : ' AND p.is_active = true';
  const result = await db.query(`
    ${packageWithAliasesQuery}
    WHERE p.id = $1${activeFilter}
    GROUP BY p.id
  `, [id]);
  return result.rows[0] || null;
};

const requirePackage = async (db, id, options) => {
  const packageRow = await getPackageById(db, id, options);
  if (!packageRow) throw new PackageServiceError('Package not found', 404);
  return packageRow;
};

const findActiveAlias = async (db, value) => {
  const aliasKey = foldAliasKey(value);
  if (!aliasKey) return null;

  const result = await db.query(`
    SELECT ${packageColumns}
    FROM package_aliases pa
    JOIN packages p ON p.id = pa.package_id
    WHERE pa.alias_key = $1 AND p.is_active = true
  `, [aliasKey]);
  return result.rows[0] || null;
};

const embeddedPinCount = (shortName) => {
  const match = shortName.match(/-(\d+)$/);
  return match ? Number(match[1]) : null;
};

const resolveAliasCandidate = async (db, token, allowModifier = true) => {
  const direct = await findActiveAlias(db, token);
  if (direct) return { package: direct, pinCount: embeddedPinCount(direct.short_name), density: null };

  const leadingCount = token.match(/^(\d+)[-\s](.+)$/);
  if (leadingCount) {
    const packageRow = await findActiveAlias(db, leadingCount[2]);
    if (packageRow) return { package: packageRow, pinCount: Number(leadingCount[1]), density: null };
  }

  const trailingCount = token.match(/^(.+?)-(\d+)$/);
  if (trailingCount) {
    const packageRow = await findActiveAlias(db, trailingCount[1]);
    if (packageRow) return { package: packageRow, pinCount: Number(trailingCount[2]), density: null };
  }

  if (allowModifier) {
    const modifier = MODIFIER_STOPLIST.find((entry) => new RegExp(`\\s+${entry.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i').test(token));
    if (modifier) {
      const stripped = token.replace(new RegExp(`\\s+${modifier.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i'), '').trim();
      return resolveAliasCandidate(db, stripped, false);
    }
  }

  return null;
};

const resolveIpcDimensionalName = async (db, token) => {
  const match = token.match(IPC_DIMENSIONAL_PATTERN);
  if (!match) return null;

  const packageRow = await findActiveAlias(db, match[1]);
  if (!packageRow) return null;

  return {
    package: packageRow,
    pinCount: Number(match[2]),
    density: ({ M: 'A', N: 'B', L: 'C' })[match[3].toUpperCase()],
  };
};

const toResolution = (input, resolved) => ({
  input,
  package: resolved?.package || null,
  shortName: resolved?.package?.short_name || null,
  pinCount: resolved?.pinCount ?? null,
  density: resolved?.density || null,
});

export const listPackages = async () => {
  const result = await pool.query(`
    ${packageWithAliasesQuery}
    WHERE p.is_active = true
    GROUP BY p.id
    ORDER BY p.display_order NULLS LAST, p.short_name
  `);
  return result.rows;
};

export const getActivePackage = (id) => getPackageById(pool, id);

/**
 * Resolve vendor-facing package text through the active catalog. A miss keeps
 * the sanitized input available to callers so unknown package text never blocks
 * a save or turns into an exception (SPEC V62).
 */
export const resolvePackage = async (raw) => {
  const input = sanitizePackageInput(raw);
  if (!input || input.toUpperCase() === 'N/A') return toResolution(input, null);

  for (const token of input.split(/[;,]/).map(value => value.trim()).filter(Boolean)) {
    const aliasResolution = await resolveAliasCandidate(pool, token);
    if (aliasResolution) return toResolution(input, aliasResolution);

    const ipcResolution = await resolveIpcDimensionalName(pool, token);
    if (ipcResolution) return toResolution(input, ipcResolution);
  }

  return toResolution(input, null);
};

export const createPackage = async (payload) => {
  const shortName = normalizeAlias(payload?.short_name);
  const family = normalizeOptionalText(payload?.family, 'family');
  const mount = normalizeOptionalText(payload?.mount, 'mount');
  const countPolicy = normalizeCountPolicy(payload?.count_policy);
  const displayOrder = normalizeDisplayOrder(payload?.display_order);
  const aliases = Array.isArray(payload?.aliases) ? payload.aliases.map(normalizeAlias) : [];
  const aliasValues = [...new Map([shortName, ...aliases].map(alias => [foldAliasKey(alias), alias])).values()];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const created = await client.query(`
      INSERT INTO packages (short_name, family, mount, count_policy, display_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [shortName, family, mount, countPolicy, displayOrder]);

    for (const alias of aliasValues) {
      await client.query('INSERT INTO package_aliases (package_id, alias) VALUES ($1, $2)', [created.rows[0].id, alias]);
    }
    await client.query('COMMIT');
    return requirePackage(pool, created.rows[0].id, { includeInactive: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const updatePackage = async (id, payload) => {
  const fields = [];
  const values = [];
  const addField = (column, value) => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (Object.hasOwn(payload || {}, 'family')) addField('family', normalizeOptionalText(payload.family, 'family'));
  if (Object.hasOwn(payload || {}, 'mount')) addField('mount', normalizeOptionalText(payload.mount, 'mount'));
  if (Object.hasOwn(payload || {}, 'count_policy')) addField('count_policy', normalizeCountPolicy(payload.count_policy));
  if (Object.hasOwn(payload || {}, 'display_order')) addField('display_order', normalizeDisplayOrder(payload.display_order));
  if (fields.length === 0) throw new PackageServiceError('No package fields to update');

  values.push(id);
  const result = await pool.query(`
    UPDATE packages SET ${fields.join(', ')}
    WHERE id = $${values.length}
    RETURNING id
  `, values);
  if (result.rows.length === 0) throw new PackageServiceError('Package not found', 404);
  return requirePackage(pool, id, { includeInactive: true });
};

export const deletePackage = async (id) => {
  const packageRow = await requirePackage(pool, id, { includeInactive: true });
  if (packageRow.is_builtin) {
    await pool.query('UPDATE packages SET is_active = false WHERE id = $1', [id]);
    return { deleted: false, deactivated: true };
  }

  await pool.query('DELETE FROM packages WHERE id = $1', [id]);
  return { deleted: true, deactivated: false };
};

export const createAlias = async (packageId, value) => {
  const alias = normalizeAlias(value);
  await requirePackage(pool, packageId, { includeInactive: true });
  const result = await pool.query(`
    INSERT INTO package_aliases (package_id, alias)
    VALUES ($1, $2)
    RETURNING id, package_id, alias
  `, [packageId, alias]);
  return result.rows[0];
};

export const updateAlias = async (packageId, aliasId, value) => {
  const alias = normalizeAlias(value);
  const packageRow = await requirePackage(pool, packageId, { includeInactive: true });
  const currentAlias = await pool.query(
    'SELECT alias FROM package_aliases WHERE id = $1 AND package_id = $2',
    [aliasId, packageId],
  );
  if (currentAlias.rows.length === 0) throw new PackageServiceError('Package alias not found', 404);
  if (foldAliasKey(currentAlias.rows[0].alias) === foldAliasKey(packageRow.short_name)) {
    throw new PackageServiceError('The canonical self-alias cannot be changed');
  }
  if (foldAliasKey(alias) === foldAliasKey(packageRow.short_name)) {
    throw new PackageServiceError('The canonical self-alias cannot be changed');
  }

  const result = await pool.query(`
    UPDATE package_aliases SET alias = $1
    WHERE id = $2 AND package_id = $3
    RETURNING id, package_id, alias
  `, [alias, aliasId, packageId]);
  return result.rows[0];
};

export const deleteAlias = async (packageId, aliasId) => {
  const packageRow = await requirePackage(pool, packageId, { includeInactive: true });
  const aliasResult = await pool.query(
    'SELECT id, alias FROM package_aliases WHERE id = $1 AND package_id = $2',
    [aliasId, packageId],
  );
  if (aliasResult.rows.length === 0) throw new PackageServiceError('Package alias not found', 404);
  if (foldAliasKey(aliasResult.rows[0].alias) === foldAliasKey(packageRow.short_name)) {
    throw new PackageServiceError('The canonical self-alias cannot be deleted');
  }

  await pool.query('DELETE FROM package_aliases WHERE id = $1 AND package_id = $2', [aliasId, packageId]);
};

export const promoteAlias = async (packageId, value) => {
  const aliasKey = foldAliasKey(value);
  if (!aliasKey) throw new PackageServiceError('Alias is required');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const packageResult = await client.query(
      'SELECT id, short_name FROM packages WHERE id = $1 FOR UPDATE',
      [packageId],
    );
    if (packageResult.rows.length === 0) throw new PackageServiceError('Package not found', 404);

    const packageRow = packageResult.rows[0];
    const aliasResult = await client.query(
      'SELECT alias FROM package_aliases WHERE package_id = $1 AND alias_key = $2',
      [packageId, aliasKey],
    );
    if (aliasResult.rows.length === 0) throw new PackageServiceError('Alias does not belong to this package', 404);

    const target = aliasResult.rows[0].alias;
    if (foldAliasKey(target) === foldAliasKey(packageRow.short_name)) {
      throw new PackageServiceError('Alias is already the canonical short name');
    }

    const conflict = await client.query(
      'SELECT id FROM packages WHERE lower(short_name) = lower($1) AND id <> $2',
      [target, packageId],
    );
    if (conflict.rows.length > 0) throw new PackageServiceError('Alias already serves as another package canonical name', 409);

    await client.query('UPDATE packages SET short_name = $1 WHERE id = $2', [target, packageId]);
    await client.query('COMMIT');
    return requirePackage(pool, packageId, { includeInactive: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
