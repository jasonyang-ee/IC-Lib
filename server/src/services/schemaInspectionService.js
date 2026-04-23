import pool from '../config/database.js';

export const EXPECTED_SCHEMA_TABLES = [
  'users',
  'component_categories',
  'manufacturers',
  'distributors',
  'components',
  'components_alternative',
  'category_specifications',
  'component_specification_values',
  'distributor_info',
  'inventory',
  'inventory_alternative',
  'footprint_sources',
  'activity_log',
  'activity_types',
  'user_activity_log',
  'projects',
  'project_components',
  'eco_settings',
  'eco_orders',
  'eco_changes',
  'eco_distributors',
  'eco_alternative_parts',
  'eco_specifications',
  'eco_approval_stages',
  'eco_stage_approvers',
  'eco_approvals',
  'smtp_settings',
  'email_notification_preferences',
  'email_log',
  'cad_files',
  'component_cad_files',
  'admin_settings',
  'eco_cad_files',
  'schema_migrations',
];

export const STARTUP_REQUIRED_TABLES = EXPECTED_SCHEMA_TABLES.filter(
  tableName => tableName !== 'schema_migrations',
);

export const EXPECTED_SCHEMA_VIEWS = [
  'production_parts',
  'prototype_parts',
  'archived_parts',
  'alternative_parts',
];

export const REPAIRABLE_SCHEMA_COLUMNS = [
  { table: 'users', column: 'file_storage_path' },
  { table: 'cad_files', column: 'missing' },
  { table: 'project_components', column: 'notes' },
  { table: 'admin_settings', column: 'eco_logo_filename' },
  { table: 'admin_settings', column: 'eco_pdf_header_text' },
  { table: 'eco_orders', column: 'current_stage_order' },
  { table: 'eco_orders', column: 'pipeline_type' },
  { table: 'eco_orders', column: 'pipeline_types' },
  { table: 'eco_approval_stages', column: 'pipeline_types' },
  { table: 'eco_alternative_parts', column: 'distributors' },
  { table: 'eco_alternative_parts', column: 'manufacturer_name' },
];

export async function inspectDatabaseSchema({
  expectedTables = STARTUP_REQUIRED_TABLES,
  expectedViews = EXPECTED_SCHEMA_VIEWS,
  requiredColumns = REPAIRABLE_SCHEMA_COLUMNS,
} = {}) {
  const tablesWithRequiredColumns = [...new Set(requiredColumns.map(({ table }) => table))];

  const [tablesResult, viewsResult, columnsResult] = await Promise.all([
    pool.query(`
      SELECT tablename AS name
      FROM pg_tables
      WHERE schemaname = 'public'
    `),
    pool.query(`
      SELECT viewname AS name
      FROM pg_views
      WHERE schemaname = 'public'
    `),
    tablesWithRequiredColumns.length === 0
      ? Promise.resolve({ rows: [] })
      : pool.query(`
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = ANY($1::text[])
        `, [tablesWithRequiredColumns]),
  ]);

  const existingTables = new Set(tablesResult.rows.map(row => row.name));
  const existingViews = new Set(viewsResult.rows.map(row => row.name));
  const existingColumns = new Set(
    columnsResult.rows.map(row => `${row.table_name}.${row.column_name}`),
  );

  const missingTables = expectedTables.filter(tableName => !existingTables.has(tableName));
  const missingViews = expectedViews.filter(viewName => !existingViews.has(viewName));
  const missingColumns = requiredColumns.filter(
    ({ table, column }) => !existingColumns.has(`${table}.${column}`),
  );

  return {
    valid: missingTables.length === 0 && missingViews.length === 0 && missingColumns.length === 0,
    missingTables,
    missingViews,
    missingColumns,
    existingTables: [...existingTables].sort(),
    existingViews: [...existingViews].sort(),
  };
}