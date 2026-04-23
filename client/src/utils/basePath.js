const KNOWN_APP_ROUTES = [
  'login',
  'dashboard',
  'library',
  'file-library',
  'inventory',
  'projects',
  'eco',
  'vendor-search',
  'reports',
  'audit',
  'user-settings',
  'admin-settings',
  'settings',
];

export const normalizeBasePath = (value) => {
  if (!value || value === './') {
    return '';
  }

  const trimmedValue = value.trim();
  if (!trimmedValue || trimmedValue === '/' || trimmedValue === './') {
    return '';
  }

  let pathname = trimmedValue;

  if (/^https?:\/\//i.test(trimmedValue)) {
    try {
      pathname = new URL(trimmedValue).pathname;
    } catch {
      pathname = trimmedValue;
    }
  }

  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`;
  }

  pathname = pathname.replace(/\/+$/, '');
  return pathname === '/' ? '' : pathname;
};

export const detectBasePathFromPathname = (pathname = window.location.pathname) => {
  const match = pathname.match(/^\/([^/]+)/);
  if (!match || !match[1]) {
    return '';
  }

  return KNOWN_APP_ROUTES.includes(match[1]) ? '' : `/${match[1]}`;
};

export const getBasePath = () => {
  const envBasePath = normalizeBasePath(import.meta.env.BASE_URL);
  if (envBasePath) {
    return envBasePath;
  }

  const baseTagHref = document.querySelector('base')?.getAttribute('href');
  const baseTagPath = normalizeBasePath(baseTagHref);
  if (baseTagPath) {
    return baseTagPath;
  }

  return detectBasePathFromPathname();
};

export const getRouterBasename = () => getBasePath() || '/';

export const buildAppPath = (path = '/') => {
  const basePath = getBasePath();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${basePath}${normalizedPath}` || '/';
};