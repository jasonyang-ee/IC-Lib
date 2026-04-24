import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('JWT_SECRET', 'test-secret-key-minimum-32-chars-long');

const { default: inventoryRoutes } = await import('../routes/inventory.js');
const { default: projectRoutes } = await import('../routes/projects.js');

const getRouteHandlers = (router, method, routePath) => {
  const layer = router.stack.find((stackLayer) => stackLayer.route
    && stackLayer.route.path === routePath
    && stackLayer.route.methods[method]);

  return layer?.route?.stack?.map((handlerLayer) => handlerLayer.handle.name) || [];
};

describe('route auth guards', () => {
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
});