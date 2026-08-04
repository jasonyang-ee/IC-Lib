import adminRoutes from './admin.js';
import authRoutes from './auth.js';
import categoryRoutes from './categories.js';
import componentRoutes from './components.js';
import dashboardRoutes from './dashboard.js';
import distributorRoutes from './distributors.js';
import ecoRoutes from './eco.js';
import fileLibraryRoutes from './fileLibrary.js';
import fileUploadRoutes from './fileUpload.js';
import inventoryRoutes from './inventory.js';
import manufacturerRoutes from './manufacturers.js';
import packageRoutes from './packages.js';
import projectRoutes from './projects.js';
import reportsRoutes from './reports.js';
import scimRoutes from './scim.js';
import searchRoutes from './search.js';
import settingsRoutes from './settings.js';
import smtpRoutes from './smtp.js';
import { ROUTE_MOUNTS } from '../constants/routeMounts.js';

const ROUTER_BINDINGS = {
  admin: adminRoutes,
  auth: authRoutes,
  categories: categoryRoutes,
  components: componentRoutes,
  dashboard: dashboardRoutes,
  distributors: distributorRoutes,
  eco: ecoRoutes,
  fileLibrary: fileLibraryRoutes,
  fileUpload: fileUploadRoutes,
  inventory: inventoryRoutes,
  manufacturers: manufacturerRoutes,
  packages: packageRoutes,
  projects: projectRoutes,
  reports: reportsRoutes,
  scim: scimRoutes,
  search: searchRoutes,
  settings: settingsRoutes,
  smtp: smtpRoutes,
};

const mountNames = ROUTE_MOUNTS.map(({ name }) => name);
const bindingNames = Object.keys(ROUTER_BINDINGS);
const hasExactNames = mountNames.length === bindingNames.length
  && mountNames.every(name => Object.prototype.hasOwnProperty.call(ROUTER_BINDINGS, name));

if (!hasExactNames || new Set(mountNames).size !== mountNames.length) {
  throw new Error('Route mount descriptors and router bindings must have exact name parity');
}

export const ROUTER_REGISTRY = Object.freeze(ROUTE_MOUNTS.map(({ name, path }) => Object.freeze({
  name,
  path,
  router: ROUTER_BINDINGS[name],
})));

/** Mount every API router in the single production order. */
export const mountApiRoutes = (app) => {
  for (const { path, router } of ROUTER_REGISTRY) {
    app.use(path, router);
  }
  return app;
};
