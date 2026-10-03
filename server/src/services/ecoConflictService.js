// Call after locking every affected component, in the submission transaction.
// Include current shared-file consumers as well as the original status snapshots:
// new parts participate in the rename without having their status changed.
export const assertNoPendingComponentEcos = async (client, componentIds) => {
  if (!componentIds.length) return;
  const result = await client.query(`
    SELECT eo.eco_number
    FROM eco_orders eo
    WHERE eo.status IN ('pending', 'in_review') AND (
      eo.component_id = ANY($1::uuid[])
      OR EXISTS (
        SELECT 1 FROM eco_file_rename_components affected
        WHERE affected.eco_id = eo.id AND affected.component_id = ANY($1::uuid[])
      )
      OR EXISTS (
        SELECT 1 FROM eco_file_rename_files renamed
        JOIN component_cad_files linked ON linked.cad_file_id = renamed.cad_file_id
        WHERE renamed.eco_id = eo.id AND linked.component_id = ANY($1::uuid[])
      )
    )
    ORDER BY eo.id LIMIT 1
  `, [[...new Set(componentIds)]]);
  if (result.rows.length) {
    const error = new Error(`An affected part already has pending ECO ${result.rows[0].eco_number}. Complete or cancel that ECO before submitting another.`);
    error.status = 409;
    throw error;
  }
};
