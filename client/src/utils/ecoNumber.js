export const formatEcoNumber = (prefix = 'ECO-', nextNumber = 1) => {
  const safePrefix = typeof prefix === 'string' ? prefix : 'ECO-';
  const parsedNumber = Number.parseInt(nextNumber, 10);
  const safeNumber = Number.isInteger(parsedNumber) && parsedNumber > 0 ? parsedNumber : 1;
  return `${safePrefix}${safeNumber}`;
};