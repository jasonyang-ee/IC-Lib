import express from 'express';
import * as scimController from '../controllers/scimController.js';
import { authenticateScim, scimError } from '../middleware/scimAuth.js';
import { SCIM_CONTENT_TYPE } from '../services/scimService.js';
import { logError } from '../utils/logger.js';

const router = express.Router();

// Express 4 does not forward rejected handler promises to error middleware.
const scimHandler = handler => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

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

const scimBodyParserError = (error, _req, res, _next) => {
  if (error.type === 'entity.too.large') {
    return scimError(res, 413, 'Request body is too large');
  }
  if (error.type === 'entity.parse.failed') {
    return scimError(res, 400, 'Request body contains invalid JSON', 'invalidSyntax');
  }
  if (['charset.unsupported', 'encoding.unsupported'].includes(error.type)) {
    return scimError(res, 415, 'Unsupported SCIM request encoding');
  }
  if (['request.aborted', 'request.size.invalid', 'entity.verify.failed'].includes(error.type)) {
    return scimError(res, error.status || 400, 'Invalid SCIM request', 'invalidSyntax');
  }
  if (error.status >= 400 && error.status < 500) {
    return scimError(res, error.status, 'Invalid SCIM request', 'invalidSyntax');
  }
  logError('SCIM', 'Unhandled SCIM request failure:', error.message);
  return scimError(res, 500, 'Internal server error');
};

router.use(scimBodyParserError);

router.get('/ServiceProviderConfig', scimHandler(scimController.getServiceProviderConfig));
router.get('/ResourceTypes', scimHandler(scimController.getResourceTypes));
router.get('/ResourceTypes/:id', scimHandler(scimController.getResourceTypeById));
router.get('/Schemas', scimHandler(scimController.getSchemas));
router.get('/Schemas/:id', scimHandler(scimController.getSchemaById));
router.get('/Users', scimHandler(scimController.listUsers));
router.get('/Users/:id', scimHandler(scimController.getUserById));
router.post('/Users', scimHandler(scimController.createUser));
router.patch('/Users/:id', scimHandler(scimController.updateUser));
router.delete('/Users/:id', scimHandler(scimController.deleteUser));

// Errors thrown by a controller after authentication stay in the SCIM media
// contract too; the app-wide JSON error handler must never shape this surface.
router.use(scimBodyParserError);

// Unsupported resources still answer in SCIM's error shape.
router.use((_req, res) => scimError(res, 404, 'Unsupported SCIM resource'));

export default router;
