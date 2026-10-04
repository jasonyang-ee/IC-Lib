import { doesStageMatchEcoPipelineTypes, getEcoPipelineTypes } from './ecoPipelineService.js';

// Call within the owning transaction, before reading ECO state. Decisions may
// run concurrently, but configuration edits must not change their rules midway.
export const lockApprovalConfiguration = (client, write = false) => client.query(
  `LOCK TABLE eco_approval_stages IN ${write ? 'SHARE ROW EXCLUSIVE' : 'SHARE'} MODE`,
);

const hasCurrentStage = (eco, stages) => stages.some(stage => (
  stage.is_active && stage.stage_order === eco.current_stage_order
  && doesStageMatchEcoPipelineTypes(stage.pipeline_types, getEcoPipelineTypes(eco))
));

// Preserve valid current-order pointers without blocking repairs to older,
// already-invalid configuration. The caller holds the configuration write lock.
export const getActiveStageContexts = async (client) => {
  const stages = await client.query('SELECT * FROM eco_approval_stages');
  const ecos = await client.query(`
    SELECT * FROM eco_orders
    WHERE status IN ('pending', 'in_review') AND current_stage_order IS NOT NULL
  `);
  return ecos.rows.filter(eco => hasCurrentStage(eco, stages.rows));
};

export const assertActiveStagesPreserved = async (client, ecos) => {
  if (!ecos.length) return;
  const stages = await client.query('SELECT * FROM eco_approval_stages');
  if (ecos.some(eco => !hasCurrentStage(eco, stages.rows))) {
    const error = new Error('This change would remove the last applicable stage at the current order of an active ECO. Complete the ECO or retain an applicable stage at that order.');
    error.status = 409;
    throw error;
  }
};
