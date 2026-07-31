import express from 'express';
import * as scimController from '../controllers/scimController.js';
import { authenticateScim } from '../middleware/scimAuth.js';
import { SCIM_CONTENT_TYPE } from '../services/scimService.js';

const router = express.Router();

// SCIM bodies arrive as `application/scim+json`, which the app-level
// `express.json()` (registered for `application/json` only) ignores - without
// this a provisioning payload would reach the handler as an empty object. GET
// requests carry no body and are unaffected. The cap is small on purpose: the
// largest legitimate payload here is one user.
router.use(express.json({ type: SCIM_CONTENT_TYPE, limit: '64kb' }));

// §V27: `authenticateScim` is the first handler on every route - service auth
// owns this boundary, and no route is reachable with an app session cookie.
router.get('/ServiceProviderConfig', authenticateScim, scimController.getServiceProviderConfig);
router.get('/ResourceTypes', authenticateScim, scimController.getResourceTypes);
router.get('/Schemas', authenticateScim, scimController.getSchemas);
router.get('/Users', authenticateScim, scimController.listUsers);
router.get('/Users/:id', authenticateScim, scimController.getUserById);
router.post('/Users', authenticateScim, scimController.createUser);
router.patch('/Users/:id', authenticateScim, scimController.updateUser);
router.delete('/Users/:id', authenticateScim, scimController.deleteUser);

export default router;
