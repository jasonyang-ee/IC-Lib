import express from 'express';
import * as packageController from '../controllers/packageController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public catalog reads (SPEC V10); ?resolve= returns a canonical match or pass-through input.
router.get('/', packageController.getPackages);
router.get('/:id', packageController.getPackageById);

// Catalog mutation is an administrative operation (SPEC V2, V27).
router.post('/', authenticate, isAdmin, packageController.createPackage);
router.put('/:id', authenticate, isAdmin, packageController.updatePackage);
router.delete('/:id', authenticate, isAdmin, packageController.deletePackage);
router.post('/:id/aliases', authenticate, isAdmin, packageController.createAlias);
router.put('/:id/aliases/:aliasId', authenticate, isAdmin, packageController.updateAlias);
router.delete('/:id/aliases/:aliasId', authenticate, isAdmin, packageController.deleteAlias);
router.post('/:id/promote', authenticate, isAdmin, packageController.promoteAlias);

export default router;
