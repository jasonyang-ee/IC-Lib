import { SCIM_BASE_PATH } from '../services/scimService.js';

/**
 * Ordered runtime API mounts. Router names are the stable keys consumed by
 * route security descriptors; paths and order mirror the production app.
 */
export const ROUTE_MOUNTS = Object.freeze([
  Object.freeze({ name: 'auth', path: '/api/auth' }),
  Object.freeze({ name: 'components', path: '/api/components' }),
  Object.freeze({ name: 'categories', path: '/api/categories' }),
  Object.freeze({ name: 'distributors', path: '/api/distributors' }),
  Object.freeze({ name: 'manufacturers', path: '/api/manufacturers' }),
  Object.freeze({ name: 'inventory', path: '/api/inventory' }),
  Object.freeze({ name: 'search', path: '/api/search' }),
  Object.freeze({ name: 'reports', path: '/api/reports' }),
  Object.freeze({ name: 'dashboard', path: '/api/dashboard' }),
  Object.freeze({ name: 'settings', path: '/api/settings' }),
  Object.freeze({ name: 'admin', path: '/api/admin' }),
  Object.freeze({ name: 'projects', path: '/api/projects' }),
  Object.freeze({ name: 'eco', path: '/api/eco' }),
  Object.freeze({ name: 'smtp', path: '/api/smtp' }),
  Object.freeze({ name: 'fileUpload', path: '/api/files' }),
  Object.freeze({ name: 'fileLibrary', path: '/api/file-library' }),
  Object.freeze({ name: 'scim', path: SCIM_BASE_PATH }),
]);
