import express from 'express';
import * as scimController from '../controllers/scimController.js';
import { authenticateScim, scimError } from '../middleware/scimAuth.js';
import { SCIM_CONTENT_TYPE } from '../services/scimService.js';

const router = express.Router();

// The router-wide gate is first, including unsupported fallback paths.
router.use(authenticateScim);

const requireScimMutationMedia = (req, res, next) => {
  if (!['POST', 'PATCH'].includes(req.method) || req.is(SCIM_CONTENT_TYPE)) {
    return next();
  }
  return scimError(res, 415, `Content-Type must be ${SCIM_CONTENT_TYPE}`);
};

// The app-level parsers skip this subtree. Authenticate and validate media
// before this bounded parser does any body work.
router.use(requireScimMutationMedia);
router.use(express.json({ type: SCIM_CONTENT_TYPE, limit: '64kb' }));

const scimBodyParserError = (error, _req, res, next) => {
  if (error.type === 'entity.too.large') {
    return scimError(res, 413, 'Request body is too large');
  }
  if (error.type === 'entity.parse.failed') {
    return scimError(res, 400, 'Request body contains invalid JSON', 'invalidSyntax');
  }
  return next(error);
};

router.use(scimBodyParserError);

router.get('/ServiceProviderConfig', scimController.getServiceProviderConfig);
router.get('/ResourceTypes', scimController.getResourceTypes);
router.get('/ResourceTypes/:id', scimController.getResourceTypeById);
router.get('/Schemas', scimController.getSchemas);
router.get('/Schemas/:id', scimController.getSchemaById);
router.get('/Users', scimController.listUsers);
router.get('/Users/:id', scimController.getUserById);
router.post('/Users', scimController.createUser);
router.patch('/Users/:id', scimController.updateUser);
router.delete('/Users/:id', scimController.deleteUser);

// Unsupported resources still answer in SCIM's error shape.
router.use((_req, res) => scimError(res, 404, 'Unsupported SCIM resource'));

export default router;
