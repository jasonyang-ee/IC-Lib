import pool from '../config/database.js';

export const EXPECTED_SCHEMA_TABLES = [
  'users',
  'component_categories',
  'manufacturers',
  'packages',
  'package_aliases',
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
  'footprint_related_cad_files',
  'admin_settings',
  'eco_cad_files',
  'eco_file_rename_files',
  'eco_file_rename_components',
  'schema_migrations',
];

export const STARTUP_REQUIRED_TABLES = EXPECTED_SCHEMA_TABLES.filter(
  tableName => tableName !== 'schema_migrations',
);

// External OrCAD-CIS/ODBC compat surface: server runtime does not query these,
// but external tooling does, so startup verifies all of them.
export const EXPECTED_SCHEMA_VIEWS = [
  'production_parts',
  'prototype_parts',
  'archived_parts',
  'alternative_parts',
  'components_full',
  'component_specifications_view',
  'eco_orders_full',
];

export const REPAIRABLE_SCHEMA_COLUMNS = [
  { table: 'users', column: 'file_storage_path' },
  { table: 'users', column: 'delegation' },
  { table: 'users', column: 'auth_provider' },
  { table: 'users', column: 'oidc_issuer' },
  { table: 'users', column: 'oidc_sub' },
  { table: 'users', column: 'oidc_tenant_id' },
  { table: 'users', column: 'oidc_object_id' },
  { table: 'cad_files', column: 'missing' },
  { table: 'components', column: 'alt_class' },
  { table: 'components', column: 'last_specs_refresh_at' },
  { table: 'project_components', column: 'alt_class' },
  { table: 'distributor_info', column: 'last_vendor_sync_at' },
  { table: 'project_components', column: 'notes' },
  { table: 'admin_settings', column: 'eco_logo_filename' },
  { table: 'admin_settings', column: 'eco_pdf_header_text' },
  { table: 'admin_settings', column: 'eco_complete_notification_email' },
  { table: 'eco_orders', column: 'current_stage_order' },
  { table: 'eco_orders', column: 'pipeline_type' },
  { table: 'eco_orders', column: 'pipeline_types' },
  { table: 'eco_approval_stages', column: 'pipeline_types' },
  { table: 'eco_approvals', column: 'acting_for_user_id' },
  { table: 'eco_alternative_parts', column: 'distributors' },
  { table: 'eco_alternative_parts', column: 'manufacturer_name' },
];

// Columns the external OrCAD-CIS/ODBC views must expose (SPEC C4). View
// existence alone is not enough: migration 18 appends alt_class to these six,
// and a database whose views predate it would still pass a name-only check
// while serving external tooling a column short. eco_orders_full is
// deliberately absent — it carries no component default.
export const REQUIRED_VIEW_COLUMNS = [
  { table: 'components_full', column: 'alt_class' },
  { table: 'component_specifications_view', column: 'alt_class' },
  { table: 'production_parts', column: 'alt_class' },
  { table: 'prototype_parts', column: 'alt_class' },
  { table: 'archived_parts', column: 'alt_class' },
  { table: 'alternative_parts', column: 'alt_class' },
];

export async function inspectDatabaseSchema({
  expectedTables = STARTUP_REQUIRED_TABLES,
  expectedViews = EXPECTED_SCHEMA_VIEWS,
  requiredColumns = REPAIRABLE_SCHEMA_COLUMNS,
  requiredViewColumns = REQUIRED_VIEW_COLUMNS,
} = {}) {
  // information_schema.columns covers views as well as base tables, so both
  // sets resolve through one query and report as one missingColumns list.
  const allRequiredColumns = [...requiredColumns, ...requiredViewColumns];
  const tablesWithRequiredColumns = [...new Set(allRequiredColumns.map(({ table }) => table))];

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
  const missingColumns = allRequiredColumns.filter(
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
