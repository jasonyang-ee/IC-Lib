import { gunzipSync } from 'zlib';

export const MAX_BACKUP_DECOMPRESSED_BYTES = 268435456;

// Keep this list in dependency order. dbTableLists.test.js locks it to the
// supported schema, while restore walks it in reverse before reinserting.
export const EXPORT_TABLES = [
  'users',
  'activity_types',
  'component_categories',
  'manufacturers',
  'packages',
  'package_aliases',
  'distributors',
  'components',
  'category_specifications',
  'cad_files',
  'eco_approval_stages',
  'eco_settings',
  'projects',
  'component_specification_values',
  'components_alternative',
  'inventory',
  'inventory_alternative',
  'distributor_info',
  'footprint_sources',
  'component_cad_files',
  'footprint_related_cad_files',
  'activity_log',
  'user_activity_log',
  'project_components',
  'eco_orders',
  'eco_stage_approvers',
  'eco_approvals',
  'eco_changes',
  'eco_distributors',
  'eco_alternative_parts',
  'eco_specifications',
  'smtp_settings',
  'email_notification_preferences',
  'email_log',
];

export class BackupValidationError extends Error {}

const isPlainObject = (value) => value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;

const quoteIdentifier = (identifier) => `"${identifier.replaceAll('"', '""')}"`;
const quoteQualifiedIdentifier = (identifier) => identifier.split('.').map(quoteIdentifier).join('.');
const MAX_BIND_PARAMETERS = 10000;

const metadataQuery = `
  SELECT column_name, data_type, is_generated, is_identity, identity_generation,
    column_default, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = $1
  ORDER BY ordinal_position
`;

const getWritableColumns = (metadata, rows, table) => {
  if (metadata.length === 0) {
    throw new BackupValidationError(`Backup restore incompatible with table ${table}`);
  }

  const sourceColumns = new Set(rows.flatMap((row) => Object.keys(row)));
  const writable = metadata.filter((column) => column.is_generated === 'NEVER');

  if (rows.length === 0) return writable;

  for (const column of metadata) {
    const optional = column.is_generated !== 'NEVER'
      || column.is_identity === 'YES'
      || column.is_nullable === 'YES'
      || column.column_default !== null;
    if (!optional && !sourceColumns.has(column.column_name)) {
      throw new BackupValidationError(`Backup restore missing required column ${table}.${column.column_name}`);
    }
  }

  return writable;
};

const serializeValue = (value, dataType) => (value !== null
  && typeof value === 'object'
  && (dataType === 'json' || dataType === 'jsonb')
  ? JSON.stringify(value)
  : value);

const insertRows = async (client, table, columns, rows) => {
  const columnsByName = new Map(columns.map((column) => [column.column_name, column]));
  const groups = new Map();

  for (const row of rows) {
    const names = columns
      .filter((column) => Object.hasOwn(row, column.column_name))
      .map((column) => column.column_name);
    const key = names.join('\u0000');
    const group = groups.get(key) || { names, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }

  let imported = 0;
  for (const { names, rows: groupedRows } of groups.values()) {
    if (names.length === 0) {
      for (const _row of groupedRows) {
        await client.query(`INSERT INTO ${quoteIdentifier(table)} DEFAULT VALUES`);
        imported++;
      }
      continue;
    }

    const maxRows = Math.max(1, Math.floor(MAX_BIND_PARAMETERS / names.length));
    const hasAlwaysIdentity = names.some((name) => columnsByName.get(name).is_identity === 'YES'
      && columnsByName.get(name).identity_generation === 'ALWAYS');
    const quotedColumns = names.map(quoteIdentifier).join(', ');
    const identityClause = hasAlwaysIdentity ? ' OVERRIDING SYSTEM VALUE' : '';

    for (let start = 0; start < groupedRows.length; start += maxRows) {
      const batch = groupedRows.slice(start, start + maxRows);
      const values = [];
      const placeholders = batch.map((row, rowIndex) => `(${names.map((name, columnIndex) => {
        values.push(serializeValue(row[name], columnsByName.get(name).data_type));
        return `$${rowIndex * names.length + columnIndex + 1}`;
      }).join(', ')})`);
      const result = await client.query(
        `INSERT INTO ${quoteIdentifier(table)} (${quotedColumns})${identityClause} VALUES ${placeholders.join(', ')}`,
        values,
      );
      imported += result.rowCount ?? batch.length;
    }
  }

  return imported;
};

const restartOwnedSequences = async (client, table, columns) => {
  for (const column of columns) {
    if (column.is_identity !== 'YES' && !String(column.column_default || '').startsWith('nextval(')) continue;

    const sequenceResult = await client.query(
      'SELECT pg_get_serial_sequence($1, $2) AS sequence_name',
      [`public.${table}`, column.column_name],
    );
    const sequenceName = sequenceResult.rows[0]?.sequence_name;
    if (!sequenceName) continue;

    const nextResult = await client.query(
      `SELECT COALESCE(MAX(${quoteIdentifier(column.column_name)}), 0) + 1 AS next_value FROM ${quoteIdentifier(table)}`,
    );
    const nextValue = String(nextResult.rows[0]?.next_value ?? '1');
    if (!/^\d+$/.test(nextValue)) {
      throw new BackupValidationError(`Backup restore invalid sequence value for ${table}.${column.column_name}`);
    }
    await client.query(`ALTER SEQUENCE ${quoteQualifiedIdentifier(sequenceName)} RESTART WITH ${nextValue}`);
  }
};

export const exportBackupSnapshot = async (db, tables = EXPORT_TABLES, now = () => new Date()) => {
  const client = await db.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    transactionStarted = true;

    const data = { _exportVersion: 1, _exportDate: now().toISOString(), tables: {} };
    for (const table of tables) {
      const result = await client.query(`SELECT * FROM ${quoteIdentifier(table)}`);
      data.tables[table] = result.rows;
    }

    await client.query('COMMIT');
    return data;
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
};

export const parseBackupFile = (compressed, tables = EXPORT_TABLES) => {
  let data;
  try {
    const json = gunzipSync(compressed, { maxOutputLength: MAX_BACKUP_DECOMPRESSED_BYTES }).toString('utf-8');
    data = JSON.parse(json);
  } catch {
    throw new BackupValidationError('Invalid backup file: could not decompress or parse JSON');
  }

  if (!isPlainObject(data) || data._exportVersion !== 1 || !isPlainObject(data.tables)) {
    throw new BackupValidationError('Invalid backup file: unsupported version or tables object');
  }

  for (const table of tables) {
    const rows = data.tables[table];
    if (!Object.hasOwn(data.tables, table) || !Array.isArray(rows) || rows.some((row) => !isPlainObject(row))) {
      throw new BackupValidationError(`Invalid backup file: malformed rows for table ${table}`);
    }
  }

  return data;
};

export const restoreBackupSnapshot = async (db, data, tables = EXPORT_TABLES) => {
  const client = await db.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const schema = new Map();
    for (const table of tables) {
      const result = await client.query(metadataQuery, [table]);
      schema.set(table, getWritableColumns(result.rows, data.tables[table], table));
    }

    await client.query('ALTER TABLE "components" DISABLE TRIGGER USER');
    for (const table of [...tables].reverse()) {
      await client.query(`DELETE FROM ${quoteIdentifier(table)}`);
    }

    const stats = { tablesImported: 0, rowsImported: 0, errors: [] };
    for (const table of tables) {
      const rows = data.tables[table];
      const imported = await insertRows(client, table, schema.get(table), rows);
      if (rows.length > 0) stats.tablesImported++;
      stats.rowsImported += imported;
      await restartOwnedSequences(client, table, schema.get(table));
    }

    await client.query('ALTER TABLE "components" ENABLE TRIGGER USER');
    await client.query('COMMIT');
    return stats;
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
