import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('JWT_SECRET', 'test-secret-key-minimum-32-chars-long');

const {
  PUBLIC_GETS,
  PUBLIC_GLOBAL_TARGETS,
  PUBLIC_MUTATIONS,
  ROUTER_MOUNTS,
  isPublicGlobalTarget,
  resolveRouteDescriptor,
} = await import('../constants/publicRoutes.js');
const { ROUTE_MOUNTS } = await import('../constants/routeMounts.js');
const { ROUTER_REGISTRY } = await import('../routes/registry.js');
const ROUTERS = Object.fromEntries(ROUTER_REGISTRY.map(({ name, router }) => [name, router]));
const {
  admin: adminRoutes,
  categories: categoryRoutes,
  components: componentRoutes,
  dashboard: dashboardRoutes,
  inventory: inventoryRoutes,
  manufacturers: manufacturerRoutes,
  packages: packageRoutes,
  projects: projectRoutes,
  scim: scimRoutes,
  settings: settingsRoutes,
} = ROUTERS;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const MUTATING_METHODS = ['post', 'put', 'patch', 'delete'];

/**
 * The guard each router's routes must start with. `/api/scim/v2` is service
 * traffic from Entra, not an app session, so its boundary is `authenticateScim`
 * (§V27/§V60) - and that guard counts nowhere else.
 */
const AUTH_GUARDS = { scim: 'authenticateScim' };
const guardFor = (routerName) => AUTH_GUARDS[routerName] || 'authenticate';

// Runtime and test read the SAME descriptors (§V10, §V27, §V32): the global
// limiter throttles PUBLIC_GLOBAL_TARGETS, and the sweep below proves those
// descriptors still describe the live routers in both directions.
const PUBLIC_MUTATION_ALLOWLIST = PUBLIC_MUTATIONS;
const PUBLIC_GET_ALLOWLIST = PUBLIC_GETS;
const NAMED_HEALTH_PROBES = new Set([
  'get /api/health liveness',
  'get /api/ready readiness',
]);

const findDirectApiMounts = (source) => [...source.matchAll(
  /app\.(get|post|put|patch|delete)\(\s*(['"])(\/api\/[^'"]+)\2\s*,\s*([A-Za-z_$][\w$]*)?/g,
)].map(([, method, , routePath, handler]) => `${method} ${routePath} ${handler || '<anonymous>'}`)
  .filter((mount) => !NAMED_HEALTH_PROBES.has(mount));

const getRouteHandlers = (router, method, routePath) => {
  const layer = router.stack.find((stackLayer) => stackLayer.route
    && stackLayer.route.path === routePath
    && stackLayer.route.methods[method]);

  return layer?.route?.stack?.map((handlerLayer) => handlerLayer.handle.name) || [];
};

const isRouterWideGuard = (layer, guard) => layer.handle.name === guard
  && layer.regexp?.fast_slash === true;

/**
 * Walk the router stack in registration order. A route counts as guarded if a
 * router-level `router.use(authenticate)` was registered before it, or its own
 * handler chain starts with `authenticate`.
 */
const findUnguardedRouterMutations = (routerName, router) => {
  const unguarded = [];
  const guard = guardFor(routerName);
  let routerAuthActive = false;

  for (const layer of router.stack) {
    if (!layer.route) {
      if (isRouterWideGuard(layer, guard)) routerAuthActive = true;
      continue;
    }

    const methods = Object.keys(layer.route.methods)
      .filter((method) => MUTATING_METHODS.includes(method));

    for (const method of methods) {
      const key = `${routerName} ${method} ${layer.route.path}`;
      if (PUBLIC_MUTATION_ALLOWLIST.has(key)) continue;

      const firstHandler = layer.route.stack[0]?.handle.name;
      if (!routerAuthActive && firstHandler !== guard) {
        unguarded.push(key);
      }
    }
  }

  return unguarded;
};

export const findUnguardedMutations = (registry) => registry
  .flatMap(({ name, router }) => findUnguardedRouterMutations(name, router));

/**
 * Same registration-order walk for GET routes: everything is either on the
 * explicit public allowlist or behind authenticate. Reports both directions of
 * drift — an unlisted public GET and a stale allowlist entry.
 */
const auditRouterGets = (routerName, router) => {
  const publicUnlisted = [];
  const guardedButListed = [];
  const guard = guardFor(routerName);
  let routerAuthActive = false;

  for (const layer of router.stack) {
    if (!layer.route) {
      if (isRouterWideGuard(layer, guard)) routerAuthActive = true;
      continue;
    }

    if (!layer.route.methods.get) continue;

    const key = `${routerName} get ${layer.route.path}`;
    const firstHandler = layer.route.stack[0]?.handle.name;
    const guarded = routerAuthActive || firstHandler === guard;

    if (!guarded && !PUBLIC_GET_ALLOWLIST.has(key)) publicUnlisted.push(key);
    if (guarded && PUBLIC_GET_ALLOWLIST.has(key)) guardedButListed.push(key);
  }

  return { publicUnlisted, guardedButListed };
};

export const auditGetRoutes = (registry) => registry
  .map(({ name, router }) => auditRouterGets(name, router));

describe('route auth guards', () => {
  it('no state-changing route in any router is reachable without authenticate (V27)', () => {
    const unguarded = findUnguardedMutations(ROUTER_REGISTRY);

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

  it('protects every package catalog mutation with admin access', () => {
    expect(getRouteHandlers(packageRoutes, 'post', '/')).toEqual(['authenticate', 'isAdmin', 'createPackage']);
    expect(getRouteHandlers(packageRoutes, 'put', '/:id')).toEqual(['authenticate', 'isAdmin', 'updatePackage']);
    expect(getRouteHandlers(packageRoutes, 'delete', '/:id')).toEqual(['authenticate', 'isAdmin', 'deletePackage']);
    expect(getRouteHandlers(packageRoutes, 'post', '/:id/aliases')).toEqual(['authenticate', 'isAdmin', 'createAlias']);
    expect(getRouteHandlers(packageRoutes, 'put', '/:id/aliases/:aliasId')).toEqual(['authenticate', 'isAdmin', 'updateAlias']);
    expect(getRouteHandlers(packageRoutes, 'delete', '/:id/aliases/:aliasId')).toEqual(['authenticate', 'isAdmin', 'deleteAlias']);
    expect(getRouteHandlers(packageRoutes, 'post', '/:id/promote')).toEqual(['authenticate', 'isAdmin', 'promoteAlias']);
  });

  it('categories router is read-only (mutations live on the admin settings surface)', () => {
    const mutatingLayers = categoryRoutes.stack.filter((layer) => layer.route
      && Object.keys(layer.route.methods).some((method) => MUTATING_METHODS.includes(method)));

    expect(mutatingLayers).toEqual([]);
  });

  it('every GET route is either on the documented public allowlist or authenticated (V10)', () => {
    const audits = auditGetRoutes(ROUTER_REGISTRY);

    expect(audits.flatMap((audit) => audit.publicUnlisted)).toEqual([]);
    expect(audits.flatMap((audit) => audit.guardedButListed)).toEqual([]);
  });

  it('tightened operational reads require auth (audit feed, DB internals)', () => {
    expect(getRouteHandlers(dashboardRoutes, 'get', '/activities/all')).toEqual(['authenticate', 'getAllActivities']);
    expect(getRouteHandlers(dashboardRoutes, 'get', '/db-info')).toEqual(['authenticate', 'getDatabaseInfo']);
    expect(getRouteHandlers(settingsRoutes, 'get', '/database/status')).toEqual(['authenticate', 'isAdmin', 'getDatabaseStatus']);
    expect(getRouteHandlers(settingsRoutes, 'get', '/database/verify')).toEqual(['authenticate', 'isAdmin', 'verifyDatabase']);
  });

  it('gates every SCIM route on authenticateScim, and only the SCIM router (§V60)', () => {
    expect(scimRoutes.stack[0].handle.name).toBe('authenticateScim');
    expect(findUnguardedMutations([{ name: 'scim', router: scimRoutes }])).toEqual([]);

    // The SCIM guard is not an app-session guard: it counts on no other router.
    const authenticateScim = (_req, _res, next) => next();
    const strayRouter = express.Router();
    strayRouter.post('/anything', authenticateScim, (_req, res) => res.end());

    expect(findUnguardedMutations([{ name: 'components', router: strayRouter }]))
      .toEqual(['components post /anything']);
  });

  it('fails when a SCIM route is added without its guard', () => {
    const unguarded = express.Router();
    unguarded.post('/Users', (_req, res) => res.end());
    unguarded.get('/Users', (_req, res) => res.end());

    const syntheticRegistry = [{ name: 'scim', router: unguarded }];
    expect(findUnguardedMutations(syntheticRegistry)).toEqual(['scim post /Users']);
    expect(auditGetRoutes(syntheticRegistry)[0].publicUnlisted).toEqual(['scim get /Users']);
  });

  it('does not treat path-scoped authenticate as a router-wide guard', () => {
    const authenticate = (_req, _res, next) => next();
    const partiallyGuarded = express.Router();
    partiallyGuarded.use('/only-here', authenticate);
    partiallyGuarded.post('/unguarded-sibling', (_req, res) => res.end());
    partiallyGuarded.get('/unguarded-sibling', (_req, res) => res.end());
    const syntheticRegistry = [{ name: 'components', router: partiallyGuarded }];

    expect(findUnguardedMutations(syntheticRegistry)).toEqual(['components post /unguarded-sibling']);
    expect(auditGetRoutes(syntheticRegistry)[0].publicUnlisted).toEqual(['components get /unguarded-sibling']);
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
  it('keeps ordered mount descriptors, bindings, and index wiring in parity', () => {
    expect(ROUTE_MOUNTS.map(({ name, path: mount }) => `${name} ${mount}`)).toEqual([
      'auth /api/auth',
      'components /api/components',
      'categories /api/categories',
      'distributors /api/distributors',
      'manufacturers /api/manufacturers',
      'packages /api/packages',
      'inventory /api/inventory',
      'search /api/search',
      'reports /api/reports',
      'dashboard /api/dashboard',
      'settings /api/settings',
      'admin /api/admin',
      'projects /api/projects',
      'eco /api/eco',
      'smtp /api/smtp',
      'fileUpload /api/files',
      'fileLibrary /api/file-library',
      'scim /api/scim/v2',
    ]);
    expect(ROUTER_REGISTRY.map(({ name, path: mount }) => `${name} ${mount}`))
      .toEqual(ROUTE_MOUNTS.map(({ name, path: mount }) => `${name} ${mount}`));
    expect(ROUTER_REGISTRY.every(({ router }) => router)).toBe(true);

    const indexSource = fs.readFileSync(path.join(repoRoot, 'server/src/index.js'), 'utf8');
    expect(indexSource.match(/mountApiRoutes\(app\)/g) || []).toHaveLength(1);
    expect(indexSource.match(/app\.use\(['"]\/api\//g) || []).toHaveLength(0);
    expect(findDirectApiMounts(indexSource)).toEqual([]);
    expect(findDirectApiMounts("app.post('/api/components', createComponent);"))
      .toEqual(['post /api/components createComponent']);
    expect(findDirectApiMounts("app.get('/api/health', anythingElse);"))
      .toEqual(['get /api/health anythingElse']);
    expect(findDirectApiMounts("app.delete('/api/components/:id', (_req, res) => res.end());"))
      .toEqual(['delete /api/components/:id <anonymous>']);
  });

  it('declares a mount for every router the app sweeps', () => {
    expect(Object.keys(ROUTER_MOUNTS).sort()).toEqual(ROUTER_REGISTRY.map(({ name }) => name).sort());
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
    expect(resolve('GET', '/api/packages?resolve=SOIC')).toBe('packages get /');
    expect(resolve('GET', '/api/packages/abc-123')).toBe('packages get /:id');
    expect(resolve('GET', '/api/components/abc-123')).toBe('components get /:id');
    expect(resolve('GET', '/api/components?search=res')).toBe('components get /');
    expect(resolve('GET', '/api/components/')).toBe('components get /');
    expect(resolve('get', '/api/auth/oidc/status')).toBe('auth get /oidc/status');
    expect(resolve('POST', '/api/inventory/search/barcode')).toBe('inventory post /search/barcode');

    // Express routing is case-insensitive and implicitly serves HEAD through
    // its GET handler, so public-target resolution must make the same choice.
    expect(resolve('GET', '/API/COMPONENTS?search=res')).toBe('components get /');
    expect(resolve('GET', '/aPi/CoMpOnEnTs/AbC-123')).toBe('components get /:id');
    expect(resolve('HEAD', '/API/AUTH/OIDC/STATUS')).toBe('auth get /oidc/status');
    expect(resolve('HEAD', '/Api/Components/AbC-123?view=full')).toBe('components get /:id');

    // wrong method, private route, unmounted prefix, and lookalike paths
    expect(resolve('POST', '/api/components')).toBeNull();
    expect(resolve('GET', '/api/eco')).toBeNull();
    expect(resolve('GET', '/api/dashboard/db-info')).toBeNull();
    expect(resolve('GET', '/api/scim/v2/Users')).toBeNull();
    expect(resolve('GET', '/api/components-archive')).toBeNull();
    expect(resolve('HEAD', '/API/COMPONENTS-ARCHIVE')).toBeNull();
    expect(resolve('GET', '/api/components/abc-123/history')).toBeNull();
    expect(resolve('POST', '/api/auth/login')).toBeNull();
  });

  it('leaves the SCIM surface outside the public and global-ceiling sets (§V60)', () => {
    for (const key of [...PUBLIC_GETS, ...PUBLIC_MUTATIONS, ...PUBLIC_GLOBAL_TARGETS]) {
      expect(key.startsWith('scim ')).toBe(false);
    }

    // Service auth owns this boundary, so the guest per-IP budget skips it.
    for (const [method, url] of [['GET', '/api/scim/v2/Users'], ['PATCH', '/api/scim/v2/Users/abc']]) {
      expect(isPublicGlobalTarget({ method, originalUrl: url })).toBe(false);
    }
  });
});
