import express from 'express';
import * as manufacturerController from '../controllers/manufacturerController.js';
import { authenticate, canWrite, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all manufacturers with optional filtering
router.get('/', manufacturerController.getAllManufacturers);

// Get manufacturer by ID
router.get('/:id', manufacturerController.getManufacturerById);

// Create new manufacturer (Library add/edit flow)
router.post('/', authenticate, canWrite, manufacturerController.createManufacturer);

// Update manufacturer (admin only)
router.put('/:id', authenticate, isAdmin, manufacturerController.updateManufacturer);

// Rename/merge manufacturer (admin Settings merge UI)
router.put('/:id/rename', authenticate, isAdmin, manufacturerController.renameManufacturer);

// Delete manufacturer (admin only)
router.delete('/:id', authenticate, isAdmin, manufacturerController.deleteManufacturer);

export default router;
