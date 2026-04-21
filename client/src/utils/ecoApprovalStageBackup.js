export const getApprovalStageBackupFilename = (date = new Date()) => (
  `eco-approval-stages-${date.toISOString().split('T')[0]}.json`
);

export const parseApprovalStageBackupFile = (parsedJson) => {
  const stages = Array.isArray(parsedJson)
    ? parsedJson
    : Array.isArray(parsedJson?.stages)
      ? parsedJson.stages
      : Array.isArray(parsedJson?.data?.stages)
        ? parsedJson.data.stages
        : null;

  if (!Array.isArray(stages)) {
    throw new Error('Invalid file format. Expected a JSON array or object with a stages array.');
  }

  if (stages.length === 0) {
    throw new Error('At least one approval stage is required.');
  }

  return stages;
};

export const buildApprovalStageImportSummary = (result) => {
  const stageResults = result?.stages || {};
  const approverResults = result?.approvers || {};

  const segments = [
    `${stageResults.created || 0} created`,
    `${stageResults.updated || 0} updated`,
  ];

  if (stageResults.deactivated) {
    segments.push(`${stageResults.deactivated} deactivated`);
  }

  segments.push(`${approverResults.assigned || 0} approvers assigned`);

  if (approverResults.skipped) {
    segments.push(`${approverResults.skipped} skipped`);
  }

  return `Import complete: ${segments.join(', ')}`;
};