import bcrypt from 'bcryptjs';

const invalid = message => Object.assign(new Error(message), { status: 400 });
const hasText = value => typeof value === 'string' && value.trim().length > 0;
const roles = new Set(['read-only', 'reviewer', 'lab', 'read-write', 'approver', 'admin']);

// Imports replace records, so reject malformed input before deleting omissions.
export const validateSettingsImport = ({ users, categories, settings }) => {
  if (users !== undefined && (!Array.isArray(users) || users.some(user =>
    !user || !hasText(user.username) || !roles.has(user.role)
    || (user.is_active !== undefined && typeof user.is_active !== 'boolean')))) {
    throw invalid('Users must contain a username, valid role and optional boolean is_active');
  }
  if (categories !== undefined && (!Array.isArray(categories) || categories.some(category =>
    !category || !hasText(category.name) || !hasText(category.prefix)
    || (category.leading_zeros !== undefined && (!Number.isInteger(category.leading_zeros) || category.leading_zeros < 1 || category.leading_zeros > 10))
    || (category.specifications !== undefined && (!Array.isArray(category.specifications)
      || category.specifications.some(spec => !spec || !hasText(spec.spec_name))))))) {
    throw invalid('Categories require a name, prefix, valid leading_zeros and named specifications');
  }
  if (settings !== undefined && (!settings || typeof settings !== 'object' || Array.isArray(settings))) {
    throw invalid('Settings must be an object');
  }
};

// The caller owns one transaction for all rows. SQL failures must reach its
// rollback; catching a row error would leave PostgreSQL's transaction aborted.
export const importUserRecords = async (client, users, actorId) => {
  const results = { created: 0, updated: 0, deactivated: 0, errors: [] };
  for (const user of users) {
    const existing = await client.query('SELECT id FROM users WHERE username = $1', [user.username]);
    if (existing.rows.length) {
      await client.query('UPDATE users SET role = $1, is_active = $2 WHERE username = $3',
        [user.role, user.is_active !== false, user.username]);
      results.updated++;
    } else {
      const passwordHash = await bcrypt.hash('changeme123', 10);
      await client.query(`INSERT INTO users (username, password_hash, role, is_active, created_by)
        VALUES ($1, $2, $3, $4, $5)`, [user.username, passwordHash, user.role, user.is_active !== false, actorId]);
      results.created++;
    }
  }
  const deactivated = await client.query(`UPDATE users SET is_active = false
    WHERE username != 'admin' AND username != ALL($1::text[]) AND is_active = true
    RETURNING id`, [users.map(user => user.username)]);
  results.deactivated = deactivated.rowCount;
  return results;
};

export const importCategoryRecords = async (client, categories) => {
  const results = {
    categories: { created: 0, updated: 0, errors: [] },
    specifications: { created: 0, updated: 0, deleted: 0, errors: [] },
  };
  for (const category of categories) {
    const existing = await client.query('SELECT id FROM component_categories WHERE name = $1', [category.name]);
    let categoryId = existing.rows[0]?.id;
    const values = [category.prefix, category.leading_zeros ?? 5, category.display_order ?? 0];
    if (categoryId) {
      await client.query('UPDATE component_categories SET prefix = $1, leading_zeros = $2, display_order = $3 WHERE id = $4', [...values, categoryId]);
      results.categories.updated++;
    } else {
      const created = await client.query(`INSERT INTO component_categories (prefix, leading_zeros, display_order, name)
        VALUES ($1, $2, $3, $4) RETURNING id`, [...values, category.name]);
      categoryId = created.rows[0].id;
      results.categories.created++;
    }
    if (category.specifications === undefined) continue;
    for (const spec of category.specifications) {
      const existingSpec = await client.query('SELECT id FROM category_specifications WHERE category_id = $1 AND spec_name = $2', [categoryId, spec.spec_name]);
      const specValues = [spec.unit || null, JSON.stringify(spec.mapping_spec_names || []), spec.display_order ?? 0, spec.is_required ?? false];
      if (existingSpec.rows.length) {
        await client.query(`UPDATE category_specifications SET unit = $1, mapping_spec_names = $2,
          display_order = $3, is_required = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`, [...specValues, existingSpec.rows[0].id]);
        results.specifications.updated++;
      } else {
        await client.query(`INSERT INTO category_specifications (unit, mapping_spec_names, display_order, is_required, category_id, spec_name)
          VALUES ($1, $2, $3, $4, $5, $6)`, [...specValues, categoryId, spec.spec_name]);
        results.specifications.created++;
      }
    }
    const removed = await client.query(`DELETE FROM category_specifications
      WHERE category_id = $1 AND spec_name != ALL($2::text[])`, [categoryId, category.specifications.map(spec => spec.spec_name)]);
    results.specifications.deleted += removed.rowCount;
  }
  return results;
};
