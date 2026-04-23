import {
  doesStageMatchEcoPipelineTypes,
  getEcoPipelineTypes,
  normalizeStagePipelineTypes,
} from './ecoPipelineService.js';

const parseStageOrder = (stageOrder) => {
  const parsedStageOrder = Number.parseInt(stageOrder, 10);
  return Number.isFinite(parsedStageOrder) ? parsedStageOrder : null;
};

const normalizeStageRecord = (stage) => ({
  ...stage,
  stage_order: parseStageOrder(stage?.stage_order),
  pipeline_types: normalizeStagePipelineTypes(stage?.pipeline_types),
});

const getApprovedCountForStage = (approvedCountsByStageId, stageId) => (
  Number(approvedCountsByStageId.get(stageId) || 0)
);

const isStageComplete = (stage, approvedCountsByStageId) => (
  getApprovedCountForStage(approvedCountsByStageId, stage.id) >= Number(stage.required_approvals || 0)
);

export const resolveEcoApprovalProgress = (eco, stages, approvedCountsByStageId = new Map()) => {
  const currentStageOrder = parseStageOrder(eco?.current_stage_order);

  if (currentStageOrder === null) {
    return {
      approvalComplete: true,
      currentStageConfigurationMismatch: false,
      currentStageOrder: null,
      currentStages: [],
    };
  }

  const ecoPipelineTypes = getEcoPipelineTypes(eco);
  const activeStages = (Array.isArray(stages) ? stages : [])
    .map(normalizeStageRecord)
    .filter((stage) => stage.is_active === true && stage.stage_order !== null)
    .sort((left, right) => left.stage_order - right.stage_order || Number(left.id || 0) - Number(right.id || 0));

  const candidateOrders = [...new Set(activeStages
    .map((stage) => stage.stage_order)
    .filter((stageOrder) => stageOrder >= currentStageOrder))];

  for (const candidateOrder of candidateOrders) {
    const matchingStages = activeStages.filter((stage) => (
      stage.stage_order === candidateOrder
      && doesStageMatchEcoPipelineTypes(stage.pipeline_types, ecoPipelineTypes)
    ));

    if (matchingStages.length === 0) {
      continue;
    }

    const hasIncompleteStage = matchingStages.some(
      (stage) => !isStageComplete(stage, approvedCountsByStageId),
    );

    if (hasIncompleteStage) {
      return {
        approvalComplete: false,
        currentStageConfigurationMismatch: false,
        currentStageOrder: candidateOrder,
        currentStages: matchingStages,
      };
    }
  }

  return {
    approvalComplete: true,
    currentStageConfigurationMismatch: false,
    currentStageOrder: null,
    currentStages: [],
  };
};