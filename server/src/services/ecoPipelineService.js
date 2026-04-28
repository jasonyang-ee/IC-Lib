export const VALID_ECO_PIPELINE_TYPES = Object.freeze([
  'proto_status_change',
  'prod_status_change',
  'spec',
  'filename',
  'shared_file_rename',
  'distributor',
  'alt_parts',
]);

export const DEFAULT_STAGE_PIPELINE_TYPES = Object.freeze([...VALID_ECO_PIPELINE_TYPES]);

export const ECO_PIPELINE_TYPE_LABELS = Object.freeze({
  proto_status_change: 'Prototype Status',
  prod_status_change: 'Production Status',
  spec: 'Spec',
  filename: 'Filename',
  shared_file_rename: 'Shared Rename',
  distributor: 'Distributor',
  alt_parts: 'Alt Parts',
});

const STATUS_PIPELINE_TYPES = new Set([
  'proto_status_change',
  'prod_status_change',
]);

const CHANGE_DETAIL_PIPELINE_TYPES = new Set([
  'spec',
  'filename',
  'shared_file_rename',
  'distributor',
  'alt_parts',
]);

const PRE_PRODUCTION_APPROVAL_STATUSES = new Set([
  'new',
  'reviewing',
  'prototype',
]);

const CAD_LINK_FIELD_NAMES = new Set([
  'pcb_footprint',
  'schematic',
  'step_model',
  'pspice',
  'pad_file',
]);

const PRIMARY_PIPELINE_TYPE_PRIORITY = [
  'shared_file_rename',
  'prod_status_change',
  'proto_status_change',
  'distributor',
  'alt_parts',
  'filename',
  'spec',
];

const isValidPipelineType = (pipelineType) => VALID_ECO_PIPELINE_TYPES.includes(pipelineType);

const mapLegacyPipelineType = (pipelineType, { generalAsAll = false } = {}) => {
  switch (pipelineType) {
    case 'general':
      return generalAsAll ? [...DEFAULT_STAGE_PIPELINE_TYPES] : ['spec'];
    case 'spec_cad':
      return ['spec', 'filename'];
    case 'status_change':
      return ['proto_status_change', 'prod_status_change'];
    default:
      return isValidPipelineType(pipelineType) ? [pipelineType] : [];
  }
};

const normalizePipelineTypeArray = (pipelineTypes, fallbackTypes = []) => {
  const seen = new Set();
  const normalized = [];

  for (const pipelineType of pipelineTypes) {
    if (!isValidPipelineType(pipelineType) || seen.has(pipelineType)) {
      continue;
    }
    seen.add(pipelineType);
    normalized.push(pipelineType);
  }

  return normalized.length > 0 ? normalized : [...fallbackTypes];
};

const hasMeaningfulDistributorChange = (change) => {
  if (!change || typeof change !== 'object') {
    return false;
  }

  const sku = typeof change.sku === 'string' ? change.sku.trim() : '';
  const url = typeof change.url === 'string' ? change.url.trim() : '';

  return Boolean(change.action || change.distributor_id || sku || url);
};

const hasAlternativeMetadataChange = (alternative) => {
  if (!alternative || typeof alternative !== 'object') {
    return false;
  }

  if (alternative.action === 'add' || alternative.action === 'delete') {
    return true;
  }

  const distributorChanges = Array.isArray(alternative.distributors)
    ? alternative.distributors.filter(hasMeaningfulDistributorChange)
    : [];

  const hasAlternativeMetadataFields = [
    'manufacturer_id',
    'manufacturer_pn',
    'manufacturer_name',
  ].some((fieldName) => alternative[fieldName] !== undefined && alternative[fieldName] !== null && alternative[fieldName] !== '');

  return hasAlternativeMetadataFields || distributorChanges.length === 0;
};

export const normalizeStagePipelineTypes = (pipelineTypes) => {
  if (!Array.isArray(pipelineTypes) || pipelineTypes.length === 0) {
    return [...DEFAULT_STAGE_PIPELINE_TYPES];
  }

  const isLegacyCatchAll = pipelineTypes.length === 1 && pipelineTypes[0] === 'general';
  const sourceTypes = isLegacyCatchAll ? DEFAULT_STAGE_PIPELINE_TYPES : pipelineTypes;

  const expanded = sourceTypes.flatMap((pipelineType) => {
    if (pipelineType === 'general') {
      return ['spec'];
    }

    return mapLegacyPipelineType(pipelineType);
  });

  return normalizePipelineTypeArray(expanded, DEFAULT_STAGE_PIPELINE_TYPES);
};

export const getEcoPipelineTypes = (eco) => {
  if (Array.isArray(eco?.pipeline_types) && eco.pipeline_types.length > 0) {
    return normalizePipelineTypeArray(eco.pipeline_types, ['spec']);
  }

  return normalizePipelineTypeArray(
    mapLegacyPipelineType(eco?.pipeline_type),
    ['spec'],
  );
};

export const getPrimaryEcoPipelineType = (pipelineTypes) => {
  const normalized = normalizePipelineTypeArray(pipelineTypes, ['spec']);

  for (const pipelineType of PRIMARY_PIPELINE_TYPE_PRIORITY) {
    if (normalized.includes(pipelineType)) {
      return pipelineType;
    }
  }

  return 'spec';
};

export const doesStageMatchEcoPipelineTypes = (stagePipelineTypes, ecoPipelineTypes) => {
  const normalizedStageTypes = normalizeStagePipelineTypes(stagePipelineTypes);
  const normalizedEcoTypes = normalizePipelineTypeArray(ecoPipelineTypes, ['spec']);

  const stageStatusTypes = normalizedStageTypes.filter((pipelineType) => STATUS_PIPELINE_TYPES.has(pipelineType));
  const stageDetailTypes = normalizedStageTypes.filter((pipelineType) => CHANGE_DETAIL_PIPELINE_TYPES.has(pipelineType));

  const statusMatches = stageStatusTypes.length === 0
    || stageStatusTypes.some((pipelineType) => normalizedEcoTypes.includes(pipelineType));
  const detailMatches = stageDetailTypes.length === 0
    || stageDetailTypes.some((pipelineType) => normalizedEcoTypes.includes(pipelineType));

  return statusMatches && detailMatches;
};

export const detectEcoPipelineTypes = ({
  changes = [],
  specifications = [],
  cadFiles = [],
  distributors = [],
  alternatives = [],
  currentApprovalStatus = null,
} = {}) => {
  const detectedTypes = new Set();
  const statusChange = changes.find((change) => change?.field_name === '_status_proposal');

  if (currentApprovalStatus === 'production') {
    detectedTypes.add('prod_status_change');
  }
  if (PRE_PRODUCTION_APPROVAL_STATUSES.has(currentApprovalStatus)) {
    detectedTypes.add('proto_status_change');
  }

  if (statusChange?.new_value === 'prototype') {
    detectedTypes.add('proto_status_change');
  }
  if (statusChange?.new_value === 'production') {
    detectedTypes.add('prod_status_change');
  }

  const hasSpecFieldChanges = changes.some((change) => (
    change?.field_name &&
    change.field_name !== '_status_proposal' &&
    !CAD_LINK_FIELD_NAMES.has(change.field_name)
  ));

  const hasCadFieldChanges = changes.some((change) => CAD_LINK_FIELD_NAMES.has(change?.field_name));
  const hasSpecificationChanges = Array.isArray(specifications) && specifications.length > 0;
  const hasCadChanges = (Array.isArray(cadFiles) && cadFiles.length > 0) || hasCadFieldChanges;
  const hasDistributorChanges = (
    (Array.isArray(distributors) && distributors.some(hasMeaningfulDistributorChange)) ||
    (Array.isArray(alternatives) && alternatives.some((alternative) => (
      Array.isArray(alternative?.distributors) &&
      alternative.distributors.some(hasMeaningfulDistributorChange)
    )))
  );

  const hasAlternativeMetadataChanges = Array.isArray(alternatives) && alternatives.some(hasAlternativeMetadataChange);
  const hasNonLifecycleStatusChange = Boolean(
    statusChange &&
    statusChange.new_value !== 'prototype' &&
    statusChange.new_value !== 'production',
  );

  if (hasSpecFieldChanges || hasSpecificationChanges || hasNonLifecycleStatusChange) {
    detectedTypes.add('spec');
  }

  if (hasAlternativeMetadataChanges) {
    detectedTypes.add('alt_parts');
  }

  if (hasCadChanges) {
    detectedTypes.add('filename');
  }

  if (hasDistributorChanges) {
    detectedTypes.add('distributor');
  }

  return [...detectedTypes];
};
