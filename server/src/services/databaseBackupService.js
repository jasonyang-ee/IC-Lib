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
