import path from 'path';

export function assertSafeLeafName(name, label = 'filename') {
  const normalizedName = String(name || '').trim();

  if (
    !normalizedName
    || normalizedName === '.'
    || normalizedName === '..'
    || /[\\/\0]/.test(normalizedName)
    || normalizedName !== path.basename(normalizedName)
  ) {
    throw new Error(`Invalid ${label}`);
  }

  return normalizedName;
}

export function resolvePathWithinBase(baseDir, ...segments) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(resolvedBase, ...segments);
  const basePrefix = resolvedBase.endsWith(path.sep) ? resolvedBase : `${resolvedBase}${path.sep}`;

  if (resolvedPath !== resolvedBase && !resolvedPath.startsWith(basePrefix)) {
    throw new Error('Resolved path escapes base directory');
  }

  return resolvedPath;
}