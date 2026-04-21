export const DEFAULT_ECO_PREFIX = 'ECO-';
export const DEFAULT_ECO_PDF_HEADER = 'Engineer Change Order';
export const DEFAULT_ECO_NEXT_NUMBER = 1;

export const normalizeEcoNextNumber = (value) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : DEFAULT_ECO_NEXT_NUMBER;
};

export const formatEcoNumber = (prefix = DEFAULT_ECO_PREFIX, nextNumber = DEFAULT_ECO_NEXT_NUMBER) => {
  const safePrefix = typeof prefix === 'string' ? prefix : DEFAULT_ECO_PREFIX;
  return `${safePrefix}${normalizeEcoNextNumber(nextNumber)}`;
};

export const normalizeEcoSettingsRow = (row = {}) => ({
  ...row,
  prefix: typeof row.prefix === 'string' ? row.prefix : DEFAULT_ECO_PREFIX,
  leading_zeros: 1,
  next_number: normalizeEcoNextNumber(row.next_number),
});

export const sanitizeEcoPdfHeaderText = (value) => {
  if (typeof value !== 'string') {
    return DEFAULT_ECO_PDF_HEADER;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0
    ? trimmedValue.slice(0, 200)
    : DEFAULT_ECO_PDF_HEADER;
};