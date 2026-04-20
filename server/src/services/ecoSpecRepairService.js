import pool from '../config/database.js';

const normalizeSpecValue = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

export const buildSequentialOrphanRepairPlan = (orphanSpecs = [], candidateSpecs = [], usedCategorySpecIds = new Set()) => {
  if (!Array.isArray(orphanSpecs) || orphanSpecs.length === 0) {
    return { assignments: [], reason: null };
  }

  const availableSpecs = (candidateSpecs || []).filter(spec => !usedCategorySpecIds.has(spec.id));
  if (availableSpecs.length === 0) {
    return { assignments: [], reason: 'No available category specifications remain for repair.' };
  }

  if (orphanSpecs.length !== availableSpecs.length) {
    return {
      assignments: [],
      reason: `Orphan ECO specification count (${orphanSpecs.length}) does not exactly match available category specification count (${availableSpecs.length}).`,
    };
  }

  return {
    assignments: orphanSpecs.map((ecoSpec, index) => ({
      ecoSpecId: ecoSpec.id,
      categorySpecId: availableSpecs[index].id,
      specName: availableSpecs[index].spec_name,
    })),
    reason: null,
  };
};

export const repairApprovedEcoSpecifications = async ({ dryRun = false } = {}) => {
  const client = await pool.connect();
  const summary = {
    dryRun,
    scannedApprovedEcos: 0,
    scannedEcoSpecificationRows: 0,
    relinkedEcoSpecificationRows: 0,
    upsertedComponentSpecificationValues: 0,
    deletedComponentSpecificationValues: 0,
    repairedEcos: [],
    unresolvedEcos: [],
  };

  try {
    await client.query('BEGIN');

    const approvedEcosResult = await client.query(`
      SELECT DISTINCT
        eo.id,
        eo.eco_number,
        eo.component_id,
        eo.approved_at,
        created_at(eo.id) AS created_at,
        c.category_id AS component_category_id
      FROM eco_orders eo
      JOIN eco_specifications es ON es.eco_id = eo.id
      LEFT JOIN components c ON c.id = eo.component_id
      WHERE eo.status = 'approved'
      ORDER BY COALESCE(eo.approved_at, created_at(eo.id)), eo.id
    `);

    for (const eco of approvedEcosResult.rows) {
      summary.scannedApprovedEcos += 1;

      if (!eco.component_id) {
        summary.unresolvedEcos.push({
          ecoId: eco.id,
          ecoNumber: eco.eco_number,
          reason: 'Approved ECO has no target component_id.',
        });
        continue;
      }

      const categoryChangeResult = await client.query(`
        SELECT new_value
        FROM eco_changes
        WHERE eco_id = $1 AND field_name = 'category_id'
        ORDER BY id DESC
        LIMIT 1
      `, [eco.id]);

      const targetCategoryId = categoryChangeResult.rows[0]?.new_value || eco.component_category_id || null;

      const ecoSpecsResult = await client.query(`
        SELECT
          es.id,
          es.category_spec_id,
          es.old_value,
          es.new_value,
          cs.spec_name
        FROM eco_specifications es
        LEFT JOIN category_specifications cs ON es.category_spec_id = cs.id
        WHERE es.eco_id = $1
        ORDER BY es.id
      `, [eco.id]);

      const ecoSpecs = ecoSpecsResult.rows;
      summary.scannedEcoSpecificationRows += ecoSpecs.length;

      const resolvedSpecs = ecoSpecs.filter(spec => spec.category_spec_id);
      const orphanSpecs = ecoSpecs.filter(spec => !spec.category_spec_id);
      let ecoRelinkedRows = 0;
      let ecoAppliedValues = 0;
      let ecoDeletedValues = 0;

      if (orphanSpecs.length > 0) {
        if (!targetCategoryId) {
          summary.unresolvedEcos.push({
            ecoId: eco.id,
            ecoNumber: eco.eco_number,
            orphanCount: orphanSpecs.length,
            reason: 'Cannot repair orphan ECO specifications because the target category could not be determined.',
          });
        } else {
          const categorySpecsResult = await client.query(`
            SELECT id, spec_name, display_order
            FROM category_specifications
            WHERE category_id = $1
            ORDER BY display_order, spec_name
          `, [targetCategoryId]);

          const plan = buildSequentialOrphanRepairPlan(
            orphanSpecs,
            categorySpecsResult.rows,
            new Set(resolvedSpecs.map(spec => spec.category_spec_id)),
          );

          if (plan.assignments.length > 0) {
            for (const assignment of plan.assignments) {
              await client.query(
                'UPDATE eco_specifications SET category_spec_id = $1 WHERE id = $2',
                [assignment.categorySpecId, assignment.ecoSpecId],
              );

              const repairedSpec = orphanSpecs.find(spec => spec.id === assignment.ecoSpecId);
              if (repairedSpec) {
                repairedSpec.category_spec_id = assignment.categorySpecId;
                repairedSpec.spec_name = assignment.specName;
                resolvedSpecs.push(repairedSpec);
              }
            }

            ecoRelinkedRows = plan.assignments.length;
            summary.relinkedEcoSpecificationRows += ecoRelinkedRows;
          } else {
            summary.unresolvedEcos.push({
              ecoId: eco.id,
              ecoNumber: eco.eco_number,
              orphanCount: orphanSpecs.length,
              targetCategoryId,
              availableCategorySpecCount: categorySpecsResult.rows.length,
              reason: plan.reason,
            });
          }
        }
      }

      for (const spec of resolvedSpecs) {
        if (!spec.category_spec_id) continue;

        const newValue = normalizeSpecValue(spec.new_value);
        if (newValue === '') {
          const deleteResult = await client.query(`
            DELETE FROM component_specification_values
            WHERE component_id = $1 AND category_spec_id = $2
          `, [eco.component_id, spec.category_spec_id]);
          ecoDeletedValues += deleteResult.rowCount;
          summary.deletedComponentSpecificationValues += deleteResult.rowCount;
          continue;
        }

        await client.query(`
          INSERT INTO component_specification_values (component_id, category_spec_id, spec_value)
          VALUES ($1, $2, $3)
          ON CONFLICT (component_id, category_spec_id)
          DO UPDATE SET spec_value = EXCLUDED.spec_value, updated_at = CURRENT_TIMESTAMP
        `, [eco.component_id, spec.category_spec_id, newValue]);
        ecoAppliedValues += 1;
        summary.upsertedComponentSpecificationValues += 1;
      }

      if (ecoRelinkedRows > 0 || ecoAppliedValues > 0 || ecoDeletedValues > 0) {
        summary.repairedEcos.push({
          ecoId: eco.id,
          ecoNumber: eco.eco_number,
          componentId: eco.component_id,
          relinkedEcoSpecificationRows: ecoRelinkedRows,
          upsertedComponentSpecificationValues: ecoAppliedValues,
          deletedComponentSpecificationValues: ecoDeletedValues,
        });
      }
    }

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }

    return summary;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
