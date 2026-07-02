import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('JWT_SECRET', 'test-secret-key-minimum-32-chars-long');

const { default: adminRoutes } = await import('../routes/admin.js');
const { default: authRoutes } = await import('../routes/auth.js');
const { default: categoryRoutes } = await import('../routes/categories.js');
const { default: componentRoutes } = await import('../routes/components.js');
const { default: dashboardRoutes } = await import('../routes/dashboard.js');
const { default: distributorRoutes } = await import('../routes/distributors.js');
const { default: ecoRoutes } = await import('../routes/eco.js');
const { default: fileLibraryRoutes } = await import('../routes/fileLibrary.js');
const { default: fileUploadRoutes } = await import('../routes/fileUpload.js');
const { default: inventoryRoutes } = await import('../routes/inventory.js');
const { default: manufacturerRoutes } = await import('../routes/manufacturers.js');
const { default: projectRoutes } = await import('../routes/projects.js');
const { default: reportsRoutes } = await import('../routes/reports.js');
const { default: searchRoutes } = await import('../routes/search.js');
const { default: settingsRoutes } = await import('../routes/settings.js');
const { default: smtpRoutes } = await import('../routes/smtp.js');

const ALL_ROUTERS = {
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
  projects: projectRoutes,
  reports: reportsRoutes,
  search: searchRoutes,
  settings: settingsRoutes,
  smtp: smtpRoutes,
};

const MUTATING_METHODS = ['post', 'put', 'patch', 'delete'];

// Deliberately public state-changing routes (documented in SPEC §V10):
// - auth POST /login: must be reachable to obtain a session
// - inventory POST /search/barcode: mutation-shaped read (barcode lookup)
const PUBLIC_MUTATION_ALLOWLIST = new Set([
  'auth post /login',
  'inventory post /search/barcode',
]);

const getRouteHandlers = (router, method, routePath) => {
  const layer = router.stack.find((stackLayer) => stackLayer.route
    && stackLayer.route.path === routePath
    && stackLayer.route.methods[method]);

  return layer?.route?.stack?.map((handlerLayer) => handlerLayer.handle.name) || [];
};

/**
 * Walk the router stack in registration order. A route counts as guarded if a
 * router-level `router.use(authenticate)` was registered before it, or its own
 * handler chain starts with `authenticate`.
 */
const findUnguardedMutations = (routerName, router) => {
  const unguarded = [];
  let routerAuthActive = false;

  for (const layer of router.stack) {
    if (!layer.route) {
      if (layer.handle.name === 'authenticate') routerAuthActive = true;
      continue;
    }

    const methods = Object.keys(layer.route.methods)
      .filter((method) => MUTATING_METHODS.includes(method));

    for (const method of methods) {
      const key = `${routerName} ${method} ${layer.route.path}`;
      if (PUBLIC_MUTATION_ALLOWLIST.has(key)) continue;

      const firstHandler = layer.route.stack[0]?.handle.name;
      if (!routerAuthActive && firstHandler !== 'authenticate') {
        unguarded.push(key);
      }
    }
  }

  return unguarded;
};

describe('route auth guards', () => {
  it('no state-changing route in any router is reachable without authenticate (V27)', () => {
    const unguarded = Object.entries(ALL_ROUTERS)
      .flatMap(([name, router]) => findUnguardedMutations(name, router));

    expect(unguarded).toEqual([]);
  });

  it('protects project mutation routes with authenticate and canWrite', () => {
    expect(getRouteHandlers(projectRoutes, 'post', '/')).toEqual(['authenticate', 'canWrite', 'createProject']);
    expect(getRouteHandlers(projectRoutes, 'put', '/:id')).toEqual(['authenticate', 'canWrite', 'updateProject']);
    expect(getRouteHandlers(projectRoutes, 'delete', '/:id')).toEqual(['authenticate', 'canWrite', 'deleteProject']);
    expect(getRouteHandlers(projectRoutes, 'post', '/:projectId/components')).toEqual(['authenticate', 'canWrite', 'addComponentToProject']);
    expect(getRouteHandlers(projectRoutes, 'put', '/:projectId/components/:componentId')).toEqual(['authenticate', 'canWrite', 'updateProjectComponent']);
    expect(getRouteHandlers(projectRoutes, 'delete', '/:projectId/components/:componentId')).toEqual(['authenticate', 'canWrite', 'removeComponentFromProject']);
    expect(getRouteHandlers(projectRoutes, 'post', '/:id/consume')).toEqual(['authenticate', 'canWrite', 'consumeProjectComponents']);
  });

  it('protects inventory mutations without blocking lookup routes', () => {
    expect(getRouteHandlers(inventoryRoutes, 'post', '/')).toEqual(['authenticate', 'canWrite', 'createInventory']);
    expect(getRouteHandlers(inventoryRoutes, 'put', '/:id')).toEqual(['authenticate', 'canWrite', 'updateInventory']);
    expect(getRouteHandlers(inventoryRoutes, 'delete', '/:id')).toEqual(['authenticate', 'canWrite', 'deleteInventory']);
    expect(getRouteHandlers(inventoryRoutes, 'put', '/alternatives/:altId')).toEqual(['authenticate', 'canWrite', 'updateAlternativeInventory']);
    expect(getRouteHandlers(inventoryRoutes, 'post', '/search/barcode')).toEqual(['searchByBarcode']);
  });

  it('protects component stock/spec/distributor bulk + single-stock routes with canWrite', () => {
    expect(getRouteHandlers(componentRoutes, 'post', '/bulk/update-stock')).toEqual(['authenticate', 'canWrite', 'bulkUpdateStock']);
    expect(getRouteHandlers(componentRoutes, 'post', '/bulk/update-specifications')).toEqual(['authenticate', 'canWrite', 'bulkUpdateSpecifications']);
    expect(getRouteHandlers(componentRoutes, 'post', '/bulk/update-distributors')).toEqual(['authenticate', 'canWrite', 'bulkUpdateDistributors']);
    expect(getRouteHandlers(componentRoutes, 'post', '/:id/update-stock')).toEqual(['authenticate', 'canWrite', 'updateComponentStock']);
  });

  it('protects manufacturer mutations (create = write role, update/rename/delete = admin)', () => {
    expect(getRouteHandlers(manufacturerRoutes, 'post', '/')).toEqual(['authenticate', 'canWrite', 'createManufacturer']);
    expect(getRouteHandlers(manufacturerRoutes, 'put', '/:id')).toEqual(['authenticate', 'isAdmin', 'updateManufacturer']);
    expect(getRouteHandlers(manufacturerRoutes, 'put', '/:id/rename')).toEqual(['authenticate', 'isAdmin', 'renameManufacturer']);
    expect(getRouteHandlers(manufacturerRoutes, 'delete', '/:id')).toEqual(['authenticate', 'isAdmin', 'deleteManufacturer']);
  });

  it('categories router is read-only (mutations live on the admin settings surface)', () => {
    const mutatingLayers = categoryRoutes.stack.filter((layer) => layer.route
      && Object.keys(layer.route.methods).some((method) => MUTATING_METHODS.includes(method)));

    expect(mutatingLayers).toEqual([]);
  });

  it('keeps destructive admin surfaces admin-gated', () => {
    expect(getRouteHandlers(adminRoutes, 'post', '/init')).toEqual(['authenticate', 'isAdmin', 'initializeDatabase']);
    expect(getRouteHandlers(adminRoutes, 'post', '/reset')).toEqual(['authenticate', 'isAdmin', 'resetDatabase']);
    expect(getRouteHandlers(dashboardRoutes, 'delete', '/activities/all')).toEqual(['authenticate', 'isAdmin', 'clearAllActivities']);
    expect(getRouteHandlers(settingsRoutes, 'post', '/database/clear')).toEqual(['authenticate', 'isAdmin', 'clearDatabase']);
    expect(getRouteHandlers(settingsRoutes, 'post', '/database/reset')).toEqual(['authenticate', 'isAdmin', 'resetDatabase']);
  });
});
