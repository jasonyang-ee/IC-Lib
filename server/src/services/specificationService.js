const normalizeTrimmedString = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const normalizeNullableString = (value) => {
  const normalized = normalizeTrimmedString(value);
  return normalized === '' ? null : normalized;
};

const normalizeMappings = (mappingSpecNames) => {
  if (!Array.isArray(mappingSpecNames)) return [];

  return [...new Set(
    mappingSpecNames
      .map(mapping => normalizeTrimmedString(mapping))
      .filter(Boolean),
  )];
};

const normalizeDisplayOrder = (displayOrder) => {
  if (displayOrder === undefined || displayOrder === null || displayOrder === '') {
    return null;
  }

  const parsed = Number(displayOrder);
  return Number.isFinite(parsed) ? parsed : null;
};

const mappingsAreEqual = (leftMappings, rightMappings) => {
  return JSON.stringify(normalizeMappings(leftMappings)) === JSON.stringify(normalizeMappings(rightMappings));
};

const fetchCategorySpecificationById = async (client, categorySpecId) => {
  if (!categorySpecId) return null;

  const result = await client.query(
    'SELECT * FROM category_specifications WHERE id = $1 LIMIT 1',
    [categorySpecId],
  );

  return result.rows[0] || null;
};

const fetchCategorySpecificationByName = async (client, categoryId, specName) => {
  if (!categoryId || !specName) return null;

  const result = await client.query(`
    SELECT *
    FROM category_specifications
    WHERE category_id = $1 AND LOWER(spec_name) = LOWER($2)
    ORDER BY display_order, updated_at DESC
    LIMIT 1
  `, [categoryId, specName]);

  return result.rows[0] || null;
};

const getNextDisplayOrder = async (client, categoryId) => {
  const result = await client.query(
    'SELECT COALESCE(MAX(display_order), -1) + 1 AS next_display_order FROM category_specifications WHERE category_id = $1',
    [categoryId],
  );

  return result.rows[0]?.next_display_order ?? 0;
};

const updateCategorySpecificationDefinition = async (client, existingSpec, specification = {}) => {
  const nextSpecName = normalizeTrimmedString(specification.spec_name) || existingSpec.spec_name;
  const nextUnit = specification.unit !== undefined
    ? normalizeNullableString(specification.unit)
    : existingSpec.unit;
  const nextMappings = specification.mapping_spec_names !== undefined
    ? normalizeMappings(specification.mapping_spec_names)
    : normalizeMappings(existingSpec.mapping_spec_names);
  const nextDisplayOrder = normalizeDisplayOrder(specification.display_order)
    ?? existingSpec.display_order
    ?? 0;
  const nextIsRequired = typeof specification.is_required === 'boolean'
    ? specification.is_required
    : Boolean(existingSpec.is_required);

  const hasChanges =
    nextSpecName !== existingSpec.spec_name ||
    nextUnit !== existingSpec.unit ||
    nextDisplayOrder !== existingSpec.display_order ||
    nextIsRequired !== existingSpec.is_required ||
    !mappingsAreEqual(nextMappings, existingSpec.mapping_spec_names);

  if (!hasChanges) {
    return existingSpec;
  }

  const result = await client.query(`
    UPDATE category_specifications
    SET
      spec_name = $1,
      unit = $2,
      mapping_spec_names = $3,
      display_order = $4,
      is_required = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *
  `, [
    nextSpecName,
    nextUnit,
    JSON.stringify(nextMappings),
    nextDisplayOrder,
    nextIsRequired,
    existingSpec.id,
  ]);

  return result.rows[0] || existingSpec;
};

export const getComponentCategoryId = async (client, componentId) => {
  const result = await client.query(
    'SELECT category_id FROM components WHERE id = $1 LIMIT 1',
    [componentId],
  );

  return result.rows[0]?.category_id || null;
};

export const syncCategorySpecification = async (client, categoryId, specification = {}) => {
  const specName = normalizeTrimmedString(specification.spec_name);
  let existingSpec = await fetchCategorySpecificationById(client, specification.category_spec_id);

  if (existingSpec && categoryId && existingSpec.category_id !== categoryId && specName) {
    existingSpec = null;
  }

  if (!existingSpec && categoryId && specName) {
    existingSpec = await fetchCategorySpecificationByName(client, categoryId, specName);
  }

  if (existingSpec) {
    return updateCategorySpecificationDefinition(client, existingSpec, specification);
  }

  if (!categoryId || !specName) {
    return null;
  }

  const displayOrder = normalizeDisplayOrder(specification.display_order)
    ?? await getNextDisplayOrder(client, categoryId);

  try {
    const result = await client.query(`
      INSERT INTO category_specifications (
        category_id,
        spec_name,
        unit,
        mapping_spec_names,
        display_order,
        is_required
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      categoryId,
      specName,
      normalizeNullableString(specification.unit),
      JSON.stringify(normalizeMappings(specification.mapping_spec_names)),
      displayOrder,
      Boolean(specification.is_required),
    ]);

    return result.rows[0] || null;
  } catch (error) {
    if (error.code !== '23505') {
      throw error;
    }

    const conflictedSpec = await fetchCategorySpecificationByName(client, categoryId, specName);
    if (!conflictedSpec) {
      throw error;
    }

    return updateCategorySpecificationDefinition(client, conflictedSpec, specification);
  }
};
