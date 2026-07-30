import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('JWT_SECRET', 'test-secret-key-minimum-32-chars-long');

const {
  PUBLIC_GETS,
  PUBLIC_GLOBAL_TARGETS,
  PUBLIC_MUTATIONS,
  ROUTER_MOUNTS,
  resolveRouteDescriptor,
} = await import('../constants/publicRoutes.js');

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

// Runtime and test read the SAME descriptors (§V10, §V27, §V32): the global
// limiter throttles PUBLIC_GLOBAL_TARGETS, and the sweep below proves those
// descriptors still describe the live routers in both directions.
const PUBLIC_MUTATION_ALLOWLIST = PUBLIC_MUTATIONS;
const PUBLIC_GET_ALLOWLIST = PUBLIC_GETS;

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

/**
 * Same registration-order walk for GET routes: everything is either on the
 * explicit public allowlist or behind authenticate. Reports both directions of
 * drift — an unlisted public GET and a stale allowlist entry.
 */
const auditGetRoutes = (routerName, router) => {
  const publicUnlisted = [];
  const guardedButListed = [];
  let routerAuthActive = false;

  for (const layer of router.stack) {
    if (!layer.route) {
      if (layer.handle.name === 'authenticate') routerAuthActive = true;
      continue;
    }

    if (!layer.route.methods.get) continue;

    const key = `${routerName} get ${layer.route.path}`;
    const firstHandler = layer.route.stack[0]?.handle.name;
    const guarded = routerAuthActive || firstHandler === 'authenticate';

    if (!guarded && !PUBLIC_GET_ALLOWLIST.has(key)) publicUnlisted.push(key);
    if (guarded && PUBLIC_GET_ALLOWLIST.has(key)) guardedButListed.push(key);
  }

  return { publicUnlisted, guardedButListed };
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

  it('every GET route is either on the documented public allowlist or authenticated (V10)', () => {
    const audits = Object.entries(ALL_ROUTERS)
      .map(([name, router]) => auditGetRoutes(name, router));

    expect(audits.flatMap((audit) => audit.publicUnlisted)).toEqual([]);
    expect(audits.flatMap((audit) => audit.guardedButListed)).toEqual([]);
  });

  it('tightened operational reads require auth (audit feed, DB internals)', () => {
    expect(getRouteHandlers(dashboardRoutes, 'get', '/activities/all')).toEqual(['authenticate', 'getAllActivities']);
    expect(getRouteHandlers(dashboardRoutes, 'get', '/db-info')).toEqual(['authenticate', 'getDatabaseInfo']);
    expect(getRouteHandlers(settingsRoutes, 'get', '/database/status')).toEqual(['authenticate', 'isAdmin', 'getDatabaseStatus']);
    expect(getRouteHandlers(settingsRoutes, 'get', '/database/verify')).toEqual(['authenticate', 'isAdmin', 'verifyDatabase']);
  });

  it('keeps destructive admin surfaces admin-gated', () => {
    expect(getRouteHandlers(adminRoutes, 'post', '/init')).toEqual(['authenticate', 'isAdmin', 'initializeDatabase']);
    expect(getRouteHandlers(adminRoutes, 'post', '/reset')).toEqual(['authenticate', 'isAdmin', 'resetDatabase']);
    expect(getRouteHandlers(dashboardRoutes, 'delete', '/activities/all')).toEqual(['authenticate', 'isAdmin', 'clearAllActivities']);
    expect(getRouteHandlers(settingsRoutes, 'post', '/database/clear')).toEqual(['authenticate', 'isAdmin', 'clearDatabase']);
    expect(getRouteHandlers(settingsRoutes, 'post', '/database/reset')).toEqual(['authenticate', 'isAdmin', 'resetDatabase']);
  });
});

describe('public route descriptors (§V10, §V32)', () => {
  it('declares a mount for every router the app sweeps', () => {
    expect(Object.keys(ROUTER_MOUNTS).sort()).toEqual(Object.keys(ALL_ROUTERS).sort());
  });

  it('names only routers that exist, in every descriptor set', () => {
    const routerNames = new Set(Object.keys(ROUTER_MOUNTS));
    const allKeys = [...PUBLIC_GETS, ...PUBLIC_MUTATIONS, ...PUBLIC_GLOBAL_TARGETS];

    for (const key of allKeys) {
      const [routerName, method] = key.split(' ');
      expect(routerNames.has(routerName)).toBe(true);
      expect(['get', 'post', 'put', 'patch', 'delete']).toContain(method);
    }
  });

  it('targets exactly the public GETs plus the barcode lookup, never login', () => {
    expect(PUBLIC_GLOBAL_TARGETS.has('inventory post /search/barcode')).toBe(true);
    expect(PUBLIC_GLOBAL_TARGETS.has('auth post /login')).toBe(false);
    for (const key of PUBLIC_GETS) expect(PUBLIC_GLOBAL_TARGETS.has(key)).toBe(true);
    expect(PUBLIC_GLOBAL_TARGETS.size).toBe(PUBLIC_GETS.size + 1);
  });

  it('resolves live request paths to descriptors, exactly', () => {
    const resolve = (method, url) => resolveRouteDescriptor(method, url, PUBLIC_GLOBAL_TARGETS);

    // static, :param, query string, trailing slash, and method casing
    expect(resolve('GET', '/api/components')).toBe('components get /');
    expect(resolve('GET', '/api/components/abc-123')).toBe('components get /:id');
    expect(resolve('GET', '/api/components?search=res')).toBe('components get /');
    expect(resolve('GET', '/api/components/')).toBe('components get /');
    expect(resolve('get', '/api/auth/oidc/status')).toBe('auth get /oidc/status');
    expect(resolve('POST', '/api/inventory/search/barcode')).toBe('inventory post /search/barcode');

    // wrong method, private route, unmounted prefix, and lookalike paths
    expect(resolve('POST', '/api/components')).toBeNull();
    expect(resolve('GET', '/api/eco')).toBeNull();
    expect(resolve('GET', '/api/dashboard/db-info')).toBeNull();
    expect(resolve('GET', '/api/scim/v2/Users')).toBeNull();
    expect(resolve('GET', '/api/components-archive')).toBeNull();
    expect(resolve('GET', '/api/components/abc-123/history')).toBeNull();
    expect(resolve('POST', '/api/auth/login')).toBeNull();
  });
});
