export const PIPELINE_TYPE_OPTIONS = Object.freeze([
  { value: 'proto_status_change', label: 'Proto Status', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  { value: 'prod_status_change', label: 'Prod Status', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  { value: 'spec', label: 'Spec', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'filename', label: 'Filename', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' },
  { value: 'shared_file_rename', label: 'Shared Rename', color: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
  { value: 'distributor', label: 'Distributor', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  { value: 'alt_parts', label: 'Alt Parts', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
]);

export const DEFAULT_STAGE_PIPELINE_TYPES = Object.freeze(
  PIPELINE_TYPE_OPTIONS.map((option) => option.value),
);

export const PIPELINE_TYPE_LABELS = Object.freeze(
  Object.fromEntries(PIPELINE_TYPE_OPTIONS.map((option) => [option.value, option.label])),
);

export const PIPELINE_TYPE_COLORS = Object.freeze(
  Object.fromEntries(PIPELINE_TYPE_OPTIONS.map((option) => [option.value, option.color])),
);

export const PIPELINE_TYPE_FILTER_OPTIONS = Object.freeze([
  { value: '', label: 'All Tags' },
  ...PIPELINE_TYPE_OPTIONS.map(({ value, label }) => ({ value, label })),
]);

const LEGACY_PIPELINE_TYPE_MAP = Object.freeze({
  general: ['spec'],
  spec_cad: ['spec', 'filename'],
  status_change: ['proto_status_change', 'prod_status_change'],
});

const VALID_PIPELINE_TYPES = new Set(DEFAULT_STAGE_PIPELINE_TYPES);

export const PIPELINE_TYPE_OPTION_GROUPS = Object.freeze([
  {
    id: 'status',
    label: 'Status Tags',
    values: ['proto_status_change', 'prod_status_change'],
  },
  {
    id: 'change',
    label: 'Change Tags',
    values: ['spec', 'filename', 'shared_file_rename', 'distributor', 'alt_parts'],
  },
]);

const normalizePipelineTypes = (pipelineTypes, fallbackType = 'spec') => {
  const normalized = [...new Set(
    (Array.isArray(pipelineTypes) ? pipelineTypes : [])
      .filter((pipelineType) => VALID_PIPELINE_TYPES.has(pipelineType)),
  )];

  return normalized.length > 0 ? normalized : [fallbackType];
};

export const getStagePipelineTypeGroups = (pipelineTypes = DEFAULT_STAGE_PIPELINE_TYPES) => {
  const normalized = normalizePipelineTypes(pipelineTypes);

  return PIPELINE_TYPE_OPTION_GROUPS.map((group) => ({
    ...group,
    options: PIPELINE_TYPE_OPTIONS.filter((option) => group.values.includes(option.value)),
    selected: normalized.filter((pipelineType) => group.values.includes(pipelineType)),
  }));
};

export const getEcoPipelineTypes = (eco) => {
  if (Array.isArray(eco?.pipeline_types) && eco.pipeline_types.length > 0) {
    return normalizePipelineTypes(eco.pipeline_types);
  }

  if (typeof eco?.pipeline_type === 'string') {
    if (LEGACY_PIPELINE_TYPE_MAP[eco.pipeline_type]) {
      return normalizePipelineTypes(LEGACY_PIPELINE_TYPE_MAP[eco.pipeline_type]);
    }

    return normalizePipelineTypes([eco.pipeline_type]);
  }

  return ['spec'];
};

export const ecoMatchesPipelineType = (eco, pipelineTypeFilter) => (
  !pipelineTypeFilter || getEcoPipelineTypes(eco).includes(pipelineTypeFilter)
);
