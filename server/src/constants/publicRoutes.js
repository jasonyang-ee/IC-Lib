/**
 * Single source of truth for the public request surface (SPEC §V10, §V27, §V32).
 *
 * Three consumers read these descriptors, so they cannot drift apart:
 *  - `routeAuthGuards.test.js` proves the allowlists match the live routers in
 *    both directions (an unlisted public route and a stale entry both fail);
 *  - the global rate limiter (§V32) throttles exactly `PUBLIC_GLOBAL_TARGETS`,
 *    so authenticated traffic never spends the shared per-IP NAT budget;
 *  - `ROUTER_MOUNTS` maps a runtime path back to the `<router> <method> <template>`
 *    key the allowlists use.
 *
 * A descriptor key is `<router> <method> <router-relative template>`, with the
 * template exactly as the router registered it, `:param` segments included.
 */

/** Router name -> mount path. Must mirror the `app.use('/api/...')` calls. */
export const ROUTER_MOUNTS = {
  admin: '/api/admin',
  auth: '/api/auth',
  categories: '/api/categories',
  components: '/api/components',
  dashboard: '/api/dashboard',
  distributors: '/api/distributors',
  eco: '/api/eco',
  fileLibrary: '/api/file-library',
  fileUpload: '/api/files',
  inventory: '/api/inventory',
  manufacturers: '/api/manufacturers',
  projects: '/api/projects',
  reports: '/api/reports',
  search: '/api/search',
  settings: '/api/settings',
  smtp: '/api/smtp',
};

/**
 * Deliberately public state-changing routes (§V27).
 * - auth POST /login: must be reachable to obtain a session
 * - inventory POST /search/barcode: mutation-shaped read (barcode lookup)
 */
export const PUBLIC_MUTATIONS = new Set([
  'auth post /login',
  'inventory post /search/barcode',
]);

/**
 * The exact public GET surface (§V10): catalog, inventory and project reads,
 * dashboard stats, reports, settings reads, CIS/label downloads, and the
 * pre-session SSO flow. Every GET not listed here must require `authenticate`.
 * Adding a public GET is a deliberate act: extend this list AND §V10.
 */
export const PUBLIC_GETS = new Set([
  // OIDC/SSO flow (§V29): status feeds the login page; login/callback carry
  // the IdP redirect flow and must be reachable pre-session
  'auth get /oidc/status',
  'auth get /oidc/login',
  'auth get /oidc/callback',
  'categories get /',
  'categories get /:id',
  'categories get /:id/next-part-number',
  'categories get /:id/components',
  'components get /',
  'components get /subcategories/suggestions',
  'components get /field-suggestions',
  'components get /:id',
  'components get /:id/specifications',
  'components get /:id/distributors',
  'components get /:id/projects',
  'components get /:id/alternatives',
  'dashboard get /stats',
  'dashboard get /recent-activities',
  'dashboard get /category-breakdown',
  'dashboard get /extended-stats',
  'distributors get /',
  'inventory get /',
  'inventory get /:id',
  'inventory get /component/:componentId',
  'inventory get /alerts/low-stock',
  'inventory get /:id/alternatives',
  'manufacturers get /',
  'manufacturers get /:id',
  'projects get /',
  'projects get /:id',
  'reports get /component-summary',
  'reports get /category-distribution',
  'reports get /inventory-value',
  'reports get /missing-footprints',
  'reports get /manufacturers',
  'reports get /low-stock',
  'settings get /features',
  'settings get /',
  'settings get /eco',
  'settings get /eco/logo',
  'settings get /eco/preview',
  'settings get /global-prefix',
  'settings get /categories',
  'settings get /categories/:categoryId/specifications',
  'settings get /cis-files',
  'settings get /cis-files/:filename',
  'settings get /label-templates',
  'settings get /label-templates/:filename',
]);

/**
 * The exact targets of the coarse per-IP ceiling (§V32) = the whole guest read
 * surface plus the barcode lookup. `POST /api/auth/login` is excluded on
 * purpose: it owns a separate, much tighter per-IP credential limiter, and
 * letting it also spend the shared NAT budget would let failed logins throttle
 * unrelated guest reads from the same office.
 */
export const PUBLIC_GLOBAL_TARGETS = new Set([
  ...PUBLIC_GETS,
  'inventory post /search/barcode',
]);

const TEMPLATE_CACHE = new Map();

/**
 * Compile a router-relative template (`/:id/alternatives`) into an anchored
 * regex. `:param` matches one non-empty, non-slash segment, so a lookalike
 * prefix (`/components/1/alternatives-archive`) can never match, and a single
 * optional trailing slash is tolerated.
 */
const templateToRegExp = (template) => {
  if (TEMPLATE_CACHE.has(template)) return TEMPLATE_CACHE.get(template);

  const pattern = template
    .split('/')
    .map((segment) => {
      if (segment === '') return '';
      if (segment.startsWith(':')) return '[^/]+';
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');

  const compiled = new RegExp(`^${pattern}/?$`);
  TEMPLATE_CACHE.set(template, compiled);
  return compiled;
};

/**
 * Resolve a live request to its descriptor key, or `null` when the path is not
 * under a known router mount. Query strings and the mount prefix are stripped
 * before matching; matching is exact on method and path shape.
 */
export const resolveRouteDescriptor = (method, url, descriptors) => {
  const path = String(url || '').split('?')[0];
  const normalizedMethod = String(method || '').toLowerCase();

  for (const [routerName, mount] of Object.entries(ROUTER_MOUNTS)) {
    if (path !== mount && !path.startsWith(`${mount}/`)) continue;

    const relative = path.slice(mount.length) || '/';
    for (const key of descriptors) {
      const [keyRouter, keyMethod, keyTemplate] = key.split(' ');
      if (keyRouter !== routerName || keyMethod !== normalizedMethod) continue;
      if (templateToRegExp(keyTemplate).test(relative)) return key;
    }
    return null;
  }

  return null;
};

/** True when a live request is one of the §V32 global-ceiling targets. */
export const isPublicGlobalTarget = (req) => (
  resolveRouteDescriptor(req.method, req.originalUrl || req.url, PUBLIC_GLOBAL_TARGETS) !== null
);
