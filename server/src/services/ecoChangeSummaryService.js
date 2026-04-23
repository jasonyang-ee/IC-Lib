const CAD_SUMMARY_FIELDS = new Set([
  'pcb_footprint',
  'schematic',
  'step_model',
  'pspice',
  'pad_file',
]);

export const normalizeEcoChangeSummaryValue = (fieldName, value) => {
  if (!CAD_SUMMARY_FIELDS.has(fieldName) || typeof value !== 'string') {
    return value;
  }

  const normalizedValues = [...new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )];

  return normalizedValues.join(',');
};

export const normalizeEcoChangeRows = (changes = []) => changes.map((change) => ({
  ...change,
  old_value: normalizeEcoChangeSummaryValue(change.field_name, change.old_value),
  new_value: normalizeEcoChangeSummaryValue(change.field_name, change.new_value),
}));
